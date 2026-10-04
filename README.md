# Awake

Minimal static Screen Wake Lock site.

## Run locally

Wake Lock generally requires HTTPS or localhost.

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Notes

- "Stop manually" counts upward while the wake lock is active.
- "Use timer" accepts direct entries such as `25m`, `1h 30m`, `90s`, or `01:30:00`.
- The circular progress ring only appears while a countdown is actively running.
- The ring is animated with `requestAnimationFrame` for smooth progress.
- When the page becomes hidden, the timer and Screen Lock pause. Both resume when the tab becomes visible again, so no time is lost while away.
- A webpage cannot power off the computer. When the countdown ends, Awake releases the wake lock so normal OS display/sleep settings take over.
