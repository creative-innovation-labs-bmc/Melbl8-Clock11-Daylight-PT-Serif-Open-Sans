(function () {
  'use strict';

  var nativeAnimate = Element.prototype.animate;
  var params = new URLSearchParams(window.location.search);
  var requestedStagger = Number(params.get('stagger'));
  var STAGGER = (requestedStagger === 0.15 || requestedStagger === 0.2 || requestedStagger === 0.25) ? requestedStagger : 0.2;
  var LEG_SECONDS = 2;
  var ACTIVE_SECONDS = LEG_SECONDS * 2;
  var BAND_COUNT = 24;
  var CYCLE_SECONDS = ((BAND_COUNT - 1) * STAGGER) + ACTIVE_SECONDS;
  var TOP_Y = -330;
  var BOTTOM_Y = 330;

  function isWaveBand(el) {
    return !!(el && el.classList && (el.classList.contains('hour-flow') || el.classList.contains('hour-col')));
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  Element.prototype.animate = function (keyframes, options) {
    if (isWaveBand(this) && Array.isArray(keyframes) && keyframes.length >= 4) {
      var hour = Number(this.getAttribute('data-hour')) || 0;
      var phaseSeconds = (Date.now() / 1000) % CYCLE_SECONDS;
      var downOffset = clamp01(LEG_SECONDS / CYCLE_SECONDS);
      var upOffset = clamp01(ACTIVE_SECONDS / CYCLE_SECONDS);
      var active = this.getAttribute('data-current-hour') === 'true';
      var topY = active ? TOP_Y - 24 : TOP_Y;
      var bottomY = active ? BOTTOM_Y + 24 : BOTTOM_Y;
      var scale = active ? 2.08 : 1.96;
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

  function refreshCurrentHour() {
    var hourText = document.getElementById('hh');
    if (!hourText) return;
    var currentHour = Number(hourText.textContent);
    if (!isFinite(currentHour)) return;

    var bands = document.querySelectorAll('.hour-flow[data-hour], .hour-col[data-hour]');
    for (var i = 0; i < bands.length; i++) {
      var active = Number(bands[i].getAttribute('data-hour')) === currentHour;
      bands[i].setAttribute('data-current-hour', active ? 'true' : 'false');
      if (active) {
        bands[i].style.opacity = '1';
        bands[i].style.zIndex = '3';
      }
    }
  }

  window.addEventListener('load', function () {
    document.documentElement.setAttribute('data-wave-stagger', String(STAGGER));
    refreshCurrentHour();
    setInterval(refreshCurrentHour, 1000);
  });
})();
