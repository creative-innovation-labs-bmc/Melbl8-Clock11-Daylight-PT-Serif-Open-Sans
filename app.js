(function () {
  'use strict';

  var ZONE = 'Australia/Melbourne';
  var LAT = -37.8183;
  var LON = 144.9467;
  var SEGMENTS = 96;

  var stage = document.getElementById('stage');
  var dayEl = document.getElementById('day');
  var dateEl = document.getElementById('date');
  var hhEl = document.getElementById('hh');
  var mmEl = document.getElementById('mm');
  var ssEl = document.getElementById('ss');
  var bandEl = document.getElementById('band');
  var sunriseLabel = document.getElementById('sunriseLabel');
  var noonLabel = document.getElementById('noonLabel');
  var sunsetLabel = document.getElementById('sunsetLabel');
  var sunriseRule = document.getElementById('sunriseRule');
  var noonRule = document.getElementById('noonRule');
  var sunsetRule = document.getElementById('sunsetRule');
  var marker = document.getElementById('currentMarker');
  var caption = document.getElementById('currentCaption');

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
    for (var i=0;i<fp.length;i++) if (fp[i].type !== 'literal') x[fp[i].type]=fp[i].value;
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
    var noon = (sunrise + sunset) / 2;
    return { sunrise: sunrise, noon: noon, sunset: sunset };
  }

  function fmtHour(decimal) {
    var h = Math.floor(decimal);
    var mins = Math.round((decimal - h) * 60);
    if (mins >= 60) { h = (h + 1) % 24; mins = 0; }
    return String(h).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
  }

  function mix(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }

  function colourAt(hour, s) {
    var dawn0 = s.sunrise - 1.35;
    var dawn1 = s.sunrise + 1.0;
    var dusk0 = s.sunset - 1.1;
    var dusk1 = s.sunset + 1.25;
    var night = [17, 24, 31];
    var predawn = [43, 56, 76];
    var dawn = [201, 170, 137];
    var day = [222, 229, 226];
    var noon = [247, 242, 220];
    var afternoon = [235, 210, 151];
    var sunset = [221, 112, 67];
    var dusk = [77, 49, 65];

    if (hour < dawn0) return night;
    if (hour < s.sunrise) return mix(predawn, dawn, (hour - dawn0) / (s.sunrise - dawn0));
    if (hour < dawn1) return mix(dawn, day, (hour - s.sunrise) / (dawn1 - s.sunrise));
    if (hour < s.noon) return mix(day, noon, (hour - dawn1) / Math.max(.01, s.noon - dawn1));
    if (hour < dusk0) return mix(noon, afternoon, (hour - s.noon) / Math.max(.01, dusk0 - s.noon));
    if (hour < s.sunset) return mix(afternoon, sunset, (hour - dusk0) / Math.max(.01, s.sunset - dusk0));
    if (hour < dusk1) return mix(sunset, dusk, (hour - s.sunset) / Math.max(.01, dusk1 - s.sunset));
    if (hour < dusk1 + 1.2) return mix(dusk, night, (hour - dusk1) / 1.2);
    return night;
  }

  function setPos(el, decimalHour) {
    el.style.left = ((decimalHour / 24) * 100) + '%';
  }

  function rebuildForDate(p) {
    var y = +p.year, m = +p.month, d = +p.day;
    solar = solarTimes(y, m, d);
    bandEl.innerHTML = '';
    for (var i = 0; i < SEGMENTS; i++) {
      var div = document.createElement('div');
      div.className = 'segment';
      var hour = (i + 0.5) / SEGMENTS * 24;
      var c = colourAt(hour, solar);
      div.style.backgroundColor = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
      bandEl.appendChild(div);
    }
    sunriseLabel.textContent = 'SUNRISE ' + fmtHour(solar.sunrise);
    noonLabel.textContent = 'SOLAR NOON ' + fmtHour(solar.noon);
    sunsetLabel.textContent = 'SUNSET ' + fmtHour(solar.sunset);
    setPos(sunriseLabel, solar.sunrise);
    setPos(noonLabel, solar.noon);
    setPos(sunsetLabel, solar.sunset);
    setPos(sunriseRule, solar.sunrise);
    setPos(noonRule, solar.noon);
    setPos(sunsetRule, solar.sunset);

    dayEl.textContent = p.weekday.toUpperCase();
    var dateText = new Intl.DateTimeFormat('en-AU', {
      timeZone: ZONE,
      day:'2-digit', month:'long', year:'numeric'
    }).format(new Date());
    dateEl.textContent = dateText.toUpperCase();
  }

  function update() {
    var now = new Date();
    var p = partsFor(now);
    var key = dateKey(p);
    if (key !== lastDateKey) {
      lastDateKey = key;
      rebuildForDate(p);
    }

    hhEl.textContent = p.hour;
    mmEl.textContent = p.minute;
    ssEl.textContent = p.second;

    var decimal = (+p.hour) + (+p.minute / 60) + (+p.second / 3600);
    setPos(marker, decimal);
    var captionPct = Math.max(4, Math.min(96, (decimal / 24) * 100));
    caption.style.left = captionPct + '%';
    caption.textContent = 'CURRENT TIME ' + p.hour + ':' + p.minute;
  }

  window.addEventListener('resize', resizeStage, { passive:true });
  resizeStage();
  update();
  setInterval(update, 1000);
})();
