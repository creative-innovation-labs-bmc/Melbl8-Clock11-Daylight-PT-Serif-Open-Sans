(function () {
  'use strict';

  var ZONE = 'Australia/Melbourne';
  var LAT = -37.8183;
  var LON = 144.9467;
  var STAGE_W = 3840;
  var STAGE_H = 804;
  var DAY_W = 3840;
  var HOUR_W = 160;

  var params = new URLSearchParams(window.location.search);
  var requestedWave = Number(params.get('wave'));
  var WAVE_SWEEP = (requestedWave === 5 || requestedWave === 7 || requestedWave === 10) ? requestedWave : 10;
  var WAVE_ACTIVE = 1;
  var WAVE_OFFSET = WAVE_SWEEP / 24;
  var waveAnimations = [];
  var lastHighlightedHour = -1;
  var lastWaveHour = -1;
  var lastDecimal = 0;

  var stage = document.getElementById('stage');
  var wallTrack = document.getElementById('wallTrack');
  var hourField = document.getElementById('hourField');
  var dayEl = document.getElementById('day');
  var dateEl = document.getElementById('date');
  var stateEl = document.getElementById('state');
  var hhEl = document.getElementById('hh');
  var mmEl = document.getElementById('mm');
  var ssEl = document.getElementById('ss');
  var zoneEl = document.getElementById('zone');

  var hourRail = document.createElement('div');
  hourRail.className = 'moving-hour-rail';
  stage.appendChild(hourRail);

  var currentReadout = document.createElement('div');
  currentReadout.className = 'current-readout';
  currentReadout.textContent = 'CURRENT 00:00';
  stage.appendChild(currentReadout);

  var lastDateKey = '';
  var solar = null;

  function resizeStage() {
    var scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    var w = STAGE_W * scale;
    var h = STAGE_H * scale;
    stage.style.transform = 'scale(' + scale + ')';
    stage.style.left = ((window.innerWidth - w) / 2) + 'px';
    stage.style.top = ((window.innerHeight - h) / 2) + 'px';
  }

  function buildHourRail() {
    hourRail.innerHTML = '';
    for (var cycle = 0; cycle < 3; cycle++) {
      for (var h = 0; h < 24; h++) {
        var mark = document.createElement('div');
        mark.className = 'rail-mark' + ((h % 6 === 0) ? ' major' : '');
        // Hour ticks mark exact hour boundaries. The old half-band offset made
        // the fixed centre pointer read 30 minutes behind the displayed time.
        mark.style.left = ((cycle * DAY_W) + (h * HOUR_W)) + 'px';
        var label = document.createElement('span');
        label.textContent = (h % 6 === 0) ? String(h).padStart(2, '0') + ':00' : String(h).padStart(2, '0');
        mark.appendChild(label);
        hourRail.appendChild(mark);
      }
    }
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
  function dayOfYear(y, m, d) { return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000); }
  function norm(v, max) { v = v % max; return v < 0 ? v + max : v; }
  function rad(v) { return v * Math.PI / 180; }
  function deg(v) { return v * 180 / Math.PI; }

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

  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  function verticalGradient(base, hour, highlighted) {
    if (highlighted) base = mix(base, [255, 255, 255], 0.18);
    var top = mix(base, [3, 8, 28], highlighted ? 0.20 : 0.32);
    var bottom = mix(base, [255, 242, 210], hour >= 10 && hour <= 15 ? (highlighted ? 0.31 : 0.20) : (highlighted ? 0.20 : 0.11));
    return 'linear-gradient(180deg,' + rgba(top, .96) + ' 0%,' + rgba(base, 1) + ' 48%,' + rgba(bottom, .96) + ' 100%)';
  }

  function cancelWaveAnimations() {
    for (var i = 0; i < waveAnimations.length; i++) waveAnimations[i].cancel();
    waveAnimations = [];
  }

  function startWaveAnimations(decimal) {
    cancelWaveAnimations();
    if (!Element.prototype.animate) return;

    var activeFraction = WAVE_ACTIVE / WAVE_SWEEP;
    var phaseSeconds = (Date.now() / 1000) % WAVE_SWEEP;
    var cols = hourField.children;
    var currentInMiddleCycle = DAY_W + ((decimal / 24) * DAY_W);
    var visibleStart = currentInMiddleCycle - (STAGE_W / 2);
    var visibleEnd = currentInMiddleCycle + (STAGE_W / 2);
    var firstIndex = Math.max(0, Math.floor(visibleStart / HOUR_W) - 2);
    var lastIndex = Math.min(cols.length - 1, Math.ceil(visibleEnd / HOUR_W) + 2);

    for (var i = 0; i < cols.length; i++) {
      cols[i].style.setProperty('animation-name', 'none', 'important');
      cols[i].style.setProperty('animation-duration', '0s', 'important');
      cols[i].style.setProperty('animation-delay', '0s', 'important');
      if (i < firstIndex || i > lastIndex) {
        cols[i].style.transform = 'translate3d(0,0,0) scaleY(1.02)';
        continue;
      }

      var h = Number(cols[i].getAttribute('data-hour'));
      var delaySeconds = (h * WAVE_OFFSET) - phaseSeconds;
      waveAnimations.push(cols[i].animate([
        { transform:'translate3d(0,0,0) scaleY(1.02)', offset:0 },
        { transform:'translate3d(0,-50px,0) scaleY(1.075)', offset:activeFraction * 0.40 },
        { transform:'translate3d(0,25px,0) scaleY(1.045)', offset:activeFraction * 0.72 },
        { transform:'translate3d(0,0,0) scaleY(1.02)', offset:activeFraction },
        { transform:'translate3d(0,0,0) scaleY(1.02)', offset:1 }
      ], {
        duration: WAVE_SWEEP * 1000,
        delay: delaySeconds * 1000,
        iterations: Infinity,
        easing: 'linear',
        fill: 'both'
      }));
    }
  }

  function buildWall() {
    hourField.innerHTML = '';
    for (var cycle = 0; cycle < 3; cycle++) {
      for (var h = 0; h < 24; h++) {
        var col = document.createElement('div');
        col.className = 'hour-col';
        col.setAttribute('data-hour', String(h));
        hourField.appendChild(col);
      }
    }
  }

  function colourWall() {
    var cols = hourField.children;
    for (var i = 0; i < cols.length; i++) {
      var h = Number(cols[i].getAttribute('data-hour'));
      cols[i].style.background = verticalGradient(colourAt(h + 0.5, solar), h + 0.5, false);
    }
    lastHighlightedHour = -1;
    lastWaveHour = -1;
  }

  function highlightCurrentHour(currentHour) {
    if (currentHour === lastHighlightedHour) return;
    lastHighlightedHour = currentHour;
    var cols = hourField.children;
    for (var i = 0; i < cols.length; i++) {
      var h = Number(cols[i].getAttribute('data-hour'));
      var current = h === currentHour;
      cols[i].style.background = verticalGradient(colourAt(h + 0.5, solar), h + 0.5, current);
      cols[i].style.zIndex = current ? '2' : '0';
    }
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
    colourWall();
    dayEl.textContent = p.weekday.toUpperCase();
    dateEl.textContent = new Intl.DateTimeFormat('en-AU', {
      timeZone: ZONE,
      day:'2-digit', month:'long', year:'numeric'
    }).format(now).toUpperCase();
    zoneEl.textContent = timezoneOffsetHours(+p.year, +p.month, +p.day) >= 10.5 ? 'AEDT' : 'AEST';
  }

  function positionWall(decimal) {
    var currentInDay = (decimal / 24) * DAY_W;
    var currentInMiddleCycle = DAY_W + currentInDay;
    var x = (STAGE_W / 2) - currentInMiddleCycle;
    var transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
    wallTrack.style.transform = transform;
    hourRail.style.transform = transform;
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

    var currentHour = +p.hour;
    var decimal = currentHour + (+p.minute / 60) + (+p.second / 3600);
    lastDecimal = decimal;
    if (currentHour !== lastWaveHour) {
      lastWaveHour = currentHour;
      startWaveAnimations(decimal);
    }
    highlightCurrentHour(currentHour);
    stateEl.textContent = stateFor(decimal);
    currentReadout.textContent = 'CURRENT ' + p.hour + ':' + p.minute;
    positionWall(decimal);
  }

  buildWall();
  buildHourRail();
  document.addEventListener('visibilitychange', function () {
    document.body.classList.toggle('paused', document.hidden);
    if (!document.hidden) startWaveAnimations(lastDecimal);
  });
  window.addEventListener('resize', resizeStage, { passive:true });
  resizeStage();
  update();
  setInterval(update, 1000);
})();
