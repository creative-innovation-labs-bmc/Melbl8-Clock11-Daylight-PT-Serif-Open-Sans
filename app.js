(function () {
  'use strict';

  var ZONE = 'Australia/Melbourne';
  var LAT = -37.8183;
  var LON = 144.9467;
  var STAGE_W = 3840;
  var PANEL_W = 1760;

  var stage = document.getElementById('stage');
  var dayEl = document.getElementById('day');
  var dateEl = document.getElementById('date');
  var stateEl = document.getElementById('state');
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
    for (var i = 0; i < parts.length; i++) if (parts[i].type !== 'literal') out[parts[i].type] = parts[i].value;
    return out;
  }

  function dateKey(p) { return p.year + '-' + p.month + '-' + p.day; }

  function dayOfYear(y, m, d) {
    return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
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
    var L = norm(M + (1.916 * Math.sin(rad(M))) + (0.020 * Math.sin(rad(2 * M))) + 282.634, 360);
    var RA = norm(deg(Math.atan(0.91764 * Math.tan(rad(L)))), 360);
    var Lquadrant = Math.floor(L / 90) * 90;
    var RAquadrant = Math.floor(RA / 90) * 90;
    RA = (RA + (Lquadrant - RAquadrant)) / 15;
    var sinDec = 0.39782 * Math.sin(rad(L));
    var cosDec = Math.cos(Math.asin(sinDec));
    var cosH = (Math.cos(rad(90.833)) - (sinDec * Math.sin(rad(LAT)))) / (cosDec * Math.cos(rad(LAT)));
    if (cosH > 1 || cosH < -1) return isSunrise ? 6 : 18;
    var H = (isSunrise ? 360 - deg(Math.acos(cosH)) : deg(Math.acos(cosH))) / 15;
    return norm(H + RA - (0.06571 * t) - 6.622 - lngHour, 24);
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
      [0, [4, 10, 24]],
      [Math.max(0, s.sunrise - 2.2), [8, 24, 55]],
      [Math.max(0, s.sunrise - 1.0), [28, 68, 132]],
      [s.sunrise, [236, 150, 103]],
      [Math.min(24, s.sunrise + 1.25), [87, 163, 226]],
      [Math.max(s.sunrise + 1.25, s.noon - 1.4), [96, 180, 238]],
      [s.noon, [255, 231, 108]],
      [Math.min(24, s.noon + 1.1), [123, 190, 239]],
      [Math.max(s.noon + 1.1, s.sunset - 1.55), [91, 163, 218]],
      [Math.max(s.noon + 1.1, s.sunset - 0.55), [241, 184, 91]],
      [s.sunset, [221, 109, 70]],
      [Math.min(24, s.sunset + 0.9), [75, 58, 111]],
      [Math.min(24, s.sunset + 2.0), [10, 22, 48]],
      [24, [4, 10, 24]]
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
    for (var i = 0; i <= 72; i++) {
      var hour = i / 3;
      stops.push(rgb(colourAt(hour, solar)) + ' ' + ((hour / 24) * 100).toFixed(3) + '%');
    }
    baseGradient.style.background = 'linear-gradient(90deg,' + stops.join(',') + ')';

    hourFlows.innerHTML = '';
    for (var h = 0; h < 24; h++) {
      var base = colourAt(h + 0.5, solar);
      var top = mix(base, [3, 8, 28], 0.34);
      var bottom = mix(base, [255, 242, 210], h >= 10 && h <= 15 ? 0.18 : 0.11);
      var flow = document.createElement('div');
      flow.className = 'hour-flow';
      flow.style.left = (((h / 24) * 100) - 0.48) + '%';
      flow.style.background = 'linear-gradient(180deg,' + rgba(top, .74) + ' 0%,' + rgba(base, .22) + ' 48%,' + rgba(bottom, .68) + ' 100%)';
      flow.style.animationDuration = (19 + ((h * 7) % 10)) + 's';
      flow.style.animationDelay = (-((h * 2.5) % 20)) + 's';
      hourFlows.appendChild(flow);
    }
  }

  function setPercent(el, hour) {
    el.style.left = ((hour / 24) * 100) + '%';
  }

  function stateFor(decimal) {
    if (decimal < solar.sunrise - 1.1) return 'DEEP NIGHT';
    if (decimal < solar.sunrise + 0.6) return 'SUNRISE BUILD';
    if (decimal < solar.noon - 0.9) return 'MORNING LIGHT';
    if (decimal < solar.noon + 1.1) return 'SOLAR NOON';
    if (decimal < solar.sunset - 1.2) return 'AFTERNOON SKY';
    if (decimal < solar.sunset + 0.8) return 'SUNSET GLOW';
    if (decimal < solar.sunset + 2.2) return 'BLUE HOUR';
    return 'NIGHTFALL';
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
    stateEl.textContent = stateFor(decimal);
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
