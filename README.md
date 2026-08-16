# Melbl8 Clock 11 · Daylight

A 3840 × 804 gallery daylight clock designed for Enplug on NVIDIA Shield.

## Production view

- Melbourne time in 24-hour HH:MM:SS
- Oversized PT Serif time display
- Day and date fixed to the left
- 24-hour daylight field with calculated sunrise, solar noon and sunset for Docklands, Melbourne
- Current-time marker advances once per second
- Open Sans for supporting information
- No external APIs or weather calls
- `noindex`, `nofollow`, `noarchive`, `nosnippet`, `noimageindex`

## Performance

The clock is intentionally lightweight: static DOM, 96 fixed daylight segments and one once-per-second update. No canvas, WebGL, filters or continuous animation.

## Files

- `index.html` production clock
- `preview.html` browser/mobile framing preview
- `styles.css` 3840 × 804 layout
- `app.js` Melbourne time, solar calculation and stage scaling
