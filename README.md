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
- "Use timer" lets you type hours, minutes, and seconds directly into the large center clock; there is no separate timer settings panel.
- The circular progress ring only appears while a countdown is actively running and is animated with `requestAnimationFrame`.
- Weekly tracked time is stored locally in the browser and resets each Monday. It counts visible time while an active screen wake lock is held.
- If the page becomes hidden, browsers can release the screen wake lock. The app warns via SweetAlert2 after the user returns and offers a "Don’t warn me again" checkbox.
- A webpage cannot power off the computer. When the countdown ends, Awake releases the wake lock so normal OS display/sleep settings take over.
