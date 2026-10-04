# keepiton

Minimal static Screen Wake Lock site.

## Run locally

Wake Lock generally requires HTTPS or localhost.

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Notes

- **Infinite** keeps the wake lock active until you stop it and counts upward from `00:00:00` without a time limit.
- **Countdown** lets you type hours, minutes, and seconds directly into the large center clock.
- The countdown and Infinite timers use `Date.now()` consistently; `requestAnimationFrame` is only used to schedule renders, avoiding mixed-clock bugs.
- The circular progress ring only appears while a countdown is actively running.
- Weekly tracked time is stored locally, resets each Monday, and advances on the same whole-second boundaries as the active timer.
- If the page becomes hidden, browsers can release the screen wake lock. The app warns via SweetAlert2 after the user returns and offers a “Don’t warn me again” checkbox.
- The footer Wake Lock API notice is static and is never replaced with transient status text.
- A webpage cannot power off the computer. When a countdown ends, keepiton releases the wake lock so normal OS display/sleep settings take over.
