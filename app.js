(function () {
  'use strict';

  var ZONE = 'Australia/Melbourne';
  var LAT = -37.8183;
  var LON = 144.9467;
  var STAGE_W = 3840;
  var PANEL_W = 930;

  var stage = document.getElementById('stage');
  var dayEl = document.getElementById('day');
  var dateEl = document.getElementById('date');
  var hhEl = document.getElementById('hh');
  var mmEl = document.getElementById('mm');
  var ssEl = document.getElementById('ss');
  var baseGradient = document.getElementById('baseGradient');
  var hourFlows = document.getElementById('hourFlows');
  var sunriseRule = document.getElementById('sunriseRule');
  var noonRule = document.getElementById('noonRule');
  var sunsetRule = document.getElementById('sunsetRule');
  var sunriseLabel = document.getElementById('sunriseLabel');
  var noonLabel = document.getElementById('noonLabel');
  var sunsetLabel = document.getElementById('sunsetLabel');
  var timeCard = document.getElementById('timeCard');
  var cardPointer = document.getElementById('cardPointer');
  var nowLine = document.getElementById('nowLine');
  var zoneEl = document.getElementById('zone');

  var lastDateKey = '';
  var solar = null;

  function resizeStage() {
    var scale = Math.min(window.innerWidth / 3840, window.innerHeight / 804);
    var w = 3840 * scale;
    var h = 804 * scale;
    stage.style.transform = 'scale(' + scale + ')';
    stage.style.left = ((window.innerWidth - w) / 2) + 'px';
    stage.style.top = ((window.innerHeight - h) / 2) + 'px';
  }

  function partsFor(date) {
    var parts = new Intl.DateTimeFormat('en-AU', {
      timeZone: ZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23', weekday: 'long'
    }).formatToParts(date);
    var out = {};
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type !== 'literal') out[parts[i].type] = parts[i].value;
    }
    return out;
  }

  function dateKey(p) { return p.year + '-' + p.month + '-' + p.day; }

  function dayOfYear(y, m, d) {
    var start = Date.UTC(y, 0, 0);
    var current = Date.UTC(y, m - 1, d);
    return Math.floor((current - start) / 86400000);
  }

  function timezoneOffsetHours(y, m, d) {
    var probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    var fp = new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONE,
      year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'
    }).formatToParts(probe);
    var x = {};
    for (var i = 0; i < fp.length; i++) if (fp[i].type !== 'literal') x[fp[i].type] = fp[i].value;
    var asUTC = Date.UTC(+x.year, +x.month - 1, +x.day, +x.hour, +x.minute, +x.second);
    return (asUTC - probe.getTime()) / 3600000;
  }

  function norm(v, max) { v = v % max; return v < 0 ? v + max : v; }
  function rad(v) { return v * Math.PI / 180; }
  function deg(v) { return v * 180 / Math.PI; }

  function solarUTC(y, m, d, isSunrise) {
    var N = dayOfYear(y, m, d);
    var lngHour = LON / 15;
    var t = N + (((isSunrise ? 6 : 18) - lngHour) / 24);
    var M = (0.9856 * t) - 3.289;
    var L = M + (1.916 * Math.sin(rad(M))) + (0.020 * Math.sin(rad(2 * M))) + 282.634;
    L = norm(L, 360);
    var RA = deg(Math.atan(0.91764 * Math.tan(rad(L))));
    RA = norm(RA, 360);
    var Lquadrant = Math.floor(L / 90) * 90;
    var RAquadrant = Math.floor(RA / 90) * 90;
    RA = (RA + (Lquadrant - RAquadrant)) / 15;
    var sinDec = 0.39782 * Math.sin(rad(L));
    var cosDec = Math.cos(Math.asin(sinDec));
    var cosH = (Math.cos(rad(90.833)) - (sinDec * Math.sin(rad(LAT)))) / (cosDec * Math.cos(rad(LAT)));
    if (cosH > 1 || cosH < -1) return isSunrise ? 6 : 18;
    var H = isSunrise ? 360 - deg(Math.acos(cosH)) : deg(Math.acos(cosH));
    H = H / 15;
    var T = H + RA - (0.06571 * t) - 6.622;
    return norm(T - lngHour, 24);
  }

  function solarTimes(y, m, d) {
    var offset = timezoneOffsetHours(y, m, d);
    var sunrise = norm(solarUTC(y, m, d, true) + offset, 24);
    var sunset = norm(solarUTC(y, m, d, false) + offset, 24);
    return { sunrise: sunrise, noon: (sunrise + sunset) / 2, sunset: sunset };
  }

  function fmtHour(decimal) {
    var h = Math.floor(decimal);
    var mins = Math.round((decimal - h) * 60);
    if (mins >= 60) { h = (h + 1) % 24; mins = 0; }
    return String(h).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
  }

  function mix(a, b, t) {
    t = Math.max(0, Math.min(1, t));
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }

  function paletteFor(s) {
    return [
      [0, [5, 10, 30]],
      [Math.max(0, s.sunrise - 2.1), [15, 31, 71]],
      [Math.max(0, s.sunrise - 0.9), [30, 67, 119]],
      [s.sunrise, [177, 100, 102]],
      [Math.min(24, s.sunrise + 1.2), [91, 157, 205]],
      [s.noon, [100, 184, 232]],
      [Math.max(s.noon, s.sunset - 1.5), [78, 145, 195]],
      [Math.max(s.noon, s.sunset - 0.55), [214, 151, 87]],
      [s.sunset, [211, 81, 61]],
      [Math.min(24, s.sunset + 0.85), [74, 51, 102]],
      [Math.min(24, s.sunset + 2.0), [9, 21, 50]],
      [24, [5, 10, 30]]
    ];
  }

  function colourAt(hour, s) {
    var p = paletteFor(s);
    for (var i = 0; i < p.length - 1; i++) {
      if (hour <= p[i + 1][0]) {
        var span = Math.max(.001, p[i + 1][0] - p[i][0]);
        return mix(p[i][1], p[i + 1][1], (hour - p[i][0]) / span);
      }
    }
    return p[p.length - 1][1];
  }

  function rgb(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  function buildSky() {
    var stops = [];
    for (var i = 0; i <= 48; i++) {
      var hour = i / 2;
      stops.push(rgb(colourAt(hour, solar)) + ' ' + ((hour / 24) * 100).toFixed(3) + '%');
    }
    baseGradient.style.background = 'linear-gradient(90deg,' + stops.join(',') + ')';

    hourFlows.innerHTML = '';
    for (var h = 0; h < 24; h++) {
      var base = colourAt(h + 0.5, solar);
      var top = mix(base, [3, 8, 28], 0.38);
      var bottom = mix(base, [245, 239, 221], 0.13);
      var flow = document.createElement('div');
      flow.className = 'hour-flow';
      flow.style.left = (((h / 24) * 100) - 0.48) + '%';
      flow.style.background =
        'linear-gradient(180deg,' + rgba(top, .72) + ' 0%,' + rgba(base, .20) + ' 48%,' + rgba(bottom, .66) + ' 100%)';
      flow.style.animationDuration = (18 + ((h * 7) % 11)) + 's';
      flow.style.animationDelay = (-((h * 2.7) % 21)) + 's';
      hourFlows.appendChild(flow);
    }
  }

  function setPercent(el, hour) {
    el.style.left = ((hour / 24) * 100) + '%';
  }

  function rebuildForDate(p, now) {
    solar = solarTimes(+p.year, +p.month, +p.day);
    buildSky();

    sunriseLabel.textContent = 'SUNRISE ' + fmtHour(solar.sunrise);
    noonLabel.textContent = 'SOLAR NOON ' + fmtHour(solar.noon);
    sunsetLabel.textContent = 'SUNSET ' + fmtHour(solar.sunset);
    setPercent(sunriseRule, solar.sunrise);
    setPercent(noonRule, solar.noon);
    setPercent(sunsetRule, solar.sunset);

    dayEl.textContent = p.weekday.toUpperCase();
    dateEl.textContent = new Intl.DateTimeFormat('en-AU', {
      timeZone: ZONE,
      day:'2-digit', month:'long', year:'numeric'
    }).format(now).toUpperCase();
    zoneEl.textContent = timezoneOffsetHours(+p.year, +p.month, +p.day) >= 10.5 ? 'AEDT' : 'AEST';
  }

  function positionCard(decimal) {
    var markerX = (decimal / 24) * STAGE_W;
    var panelX = Math.max(0, Math.min(STAGE_W - PANEL_W, markerX - PANEL_W / 2));
    var tipX = markerX - panelX;

    timeCard.style.transform = 'translate3d(' + panelX.toFixed(2) + 'px,0,0)';
    cardPointer.style.transform = 'translate3d(' + tipX.toFixed(2) + 'px,0,0)';
    nowLine.style.transform = 'translate3d(' + markerX.toFixed(2) + 'px,0,0)';
  }

  function update() {
    var now = new Date();
    var p = partsFor(now);
    var key = dateKey(p);
    if (key !== lastDateKey) {
      lastDateKey = key;
      rebuildForDate(p, now);
    }

    hhEl.textContent = p.hour;
    mmEl.textContent = p.minute;
    ssEl.textContent = p.second;

    var decimal = (+p.hour) + (+p.minute / 60) + (+p.second / 3600);
    positionCard(decimal);
  }

  document.addEventListener('visibilitychange', function () {
    document.body.classList.toggle('paused', document.hidden);
  });
  window.addEventListener('resize', resizeStage, { passive:true });
  resizeStage();
  update();
  setInterval(update, 1000);
})();
