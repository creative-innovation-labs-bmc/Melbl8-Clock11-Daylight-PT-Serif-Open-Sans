(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var requestedWave = Number(params.get('wave'));
  var WAVE_TOTAL = (requestedWave === 3 || requestedWave === 5 || requestedWave === 7 || requestedWave === 10) ? requestedWave : 5;
  var LEG_SECONDS = 2;
  var ACTIVE_SECONDS = LEG_SECONDS * 2;
  var BAND_COUNT = 24;
  var STAGGER = WAVE_TOTAL / BAND_COUNT;
  var CYCLE_SECONDS = Math.max(WAVE_TOTAL, ACTIVE_SECONDS);
  var TOP_Y = -390;
  var BOTTOM_Y = 390;
  var nativeAnimate = Element.prototype.animate;

  function isWaveBand(el) {
    return !!(el && el.classList && (el.classList.contains('hour-flow') || el.classList.contains('hour-col')));
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function currentPhaseSeconds() {
    return (Date.now() / 1000) % CYCLE_SECONDS;
  }

  if (nativeAnimate) {
    document.documentElement.classList.add('wave-waapi');

    Element.prototype.animate = function (keyframes, options) {
      if (isWaveBand(this) && Array.isArray(keyframes) && keyframes.length >= 4) {
        var hour = Number(this.getAttribute('data-hour')) || 0;
        var phaseSeconds = currentPhaseSeconds();
        var downOffset = clamp01(LEG_SECONDS / CYCLE_SECONDS);
        var upOffset = clamp01(ACTIVE_SECONDS / CYCLE_SECONDS);
        var active = this.getAttribute('data-current-hour') === 'true';
        var topY = active ? TOP_Y - 22 : TOP_Y;
        var bottomY = active ? BOTTOM_Y + 22 : BOTTOM_Y;
        var scale = active ? 1.86 : 1.80;
        var delaySeconds = (hour * STAGGER) - phaseSeconds;

        return nativeAnimate.call(this, [
          { transform:'translate3d(0,' + topY + 'px,0) scaleY(' + scale + ')', offset:0 },
          { transform:'translate3d(0,' + bottomY + 'px,0) scaleY(' + scale + ')', offset:downOffset },
          { transform:'translate3d(0,' + topY + 'px,0) scaleY(' + scale + ')', offset:upOffset },
          { transform:'translate3d(0,' + topY + 'px,0) scaleY(' + scale + ')', offset:1 }
        ], {
          duration: CYCLE_SECONDS * 1000,
          delay: delaySeconds * 1000,
          iterations: Infinity,
          easing: 'linear',
          fill: 'both'
        });
      }

      return nativeAnimate.call(this, keyframes, options);
    };
  } else {
    document.documentElement.classList.add('wave-css-fallback');
  }

  function refreshCurrentHour() {
    var hourText = document.getElementById('hh');
    if (!hourText) return;
    var currentHour = Number(hourText.textContent);
    if (!isFinite(currentHour)) return;

    var bands = document.querySelectorAll('.hour-flow[data-hour], .hour-col[data-hour]');
    var phaseSeconds = currentPhaseSeconds();

    for (var i = 0; i < bands.length; i++) {
      var hour = Number(bands[i].getAttribute('data-hour')) || 0;
      var active = hour === currentHour;
      bands[i].setAttribute('data-current-hour', active ? 'true' : 'false');

      if (!nativeAnimate) {
        bands[i].style.setProperty('--wave-delay', ((hour * STAGGER) - phaseSeconds) + 's');
      }

      if (active) {
        bands[i].style.zIndex = '3';
      } else if (bands[i].style.zIndex === '3') {
        bands[i].style.zIndex = '0';
      }
    }
  }

  window.addEventListener('load', function () {
    refreshCurrentHour();
    setInterval(refreshCurrentHour, 1000);
  });
})();
