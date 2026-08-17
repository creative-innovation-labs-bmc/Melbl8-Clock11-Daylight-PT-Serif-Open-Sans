(function () {
  'use strict';

  var nativeAnimate = Element.prototype.animate;

  function isWaveBand(el) {
    return !!(el && el.classList && (el.classList.contains('hour-flow') || el.classList.contains('hour-col')));
  }

  Element.prototype.animate = function (keyframes, options) {
    if (isWaveBand(this) && Array.isArray(keyframes) && keyframes.length >= 5) {
      var frames = keyframes.map(function (frame) {
        var copy = {};
        for (var key in frame) copy[key] = frame[key];
        return copy;
      });

      frames[0].transform = 'translate3d(0,0,0) scaleY(1.10)';
      frames[1].transform = 'translate3d(0,-128px,0) scaleY(1.34)';
      frames[2].transform = 'translate3d(0,82px,0) scaleY(1.23)';
      frames[3].transform = 'translate3d(0,0,0) scaleY(1.10)';
      frames[frames.length - 1].transform = 'translate3d(0,0,0) scaleY(1.10)';

      return nativeAnimate.call(this, frames, options);
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
    refreshCurrentHour();
    setInterval(refreshCurrentHour, 1000);
  });
})();
