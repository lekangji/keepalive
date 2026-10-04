# keepalive

Minimal static Screen Wake Lock site.

## Run locally

Wake Lock generally requires HTTPS or localhost.

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Notes

- **Infinite** keeps the wake lock active and counts upward without a time limit. Pause and resume preserve elapsed time.
- **Timer** lets you type hours, minutes, and seconds directly into the clock. Press Enter to start.
- The primary button pauses and resumes the countdown. Only editing the duration or clicking **Restart** resets it. Restart continues immediately if the timer was running.
- The countdown and Infinite timers use `Date.now()` consistently; `requestAnimationFrame` is only used to schedule renders, avoiding mixed-clock bugs.
- Daily and weekly totals show hours and minutes, counting only time with an active, visible wake lock. Days reset at local midnight; weeks start Monday. Existing weekly totals migrate without inventing historical daily totals.
- **Open floating window** moves the same controls into an always-on-top Document Picture-in-Picture window in supporting browsers, such as Chrome and Edge. Wake lock transfers to the floating document, so the main tab can be hidden. Closing the floating window restores the controls and requests a new lock if the main tab is visible.
- If the active document becomes hidden, browsers can release the screen wake lock. Focus warnings, errors, and completion alerts appear only in Timer mode; Infinite reports status inline.
- The footer Wake Lock API notice is static and is never replaced with transient status text.
- A webpage cannot power off the computer. When a countdown ends, keepalive releases the wake lock so normal OS display/sleep settings take over.

## Organization

- `index.html`: accessible page structure; `app.js`: initialization.
- `js/`: shared state, formatting, theme, activity tracking, timer display, wake lock, session lifecycle, floating window, and event bindings.
- `css/`: base tokens, header, timer controls, feedback, and responsive rules. `styles.css` imports these files.
- `assets/coffee.svg`: shared brand icon and favicon.

## Verification

Run the focused regression tests without installing dependencies:

```bash
node --test tests/core.test.cjs
```

Native always-on-top placement and OS sleep prevention require a manual check in a supporting desktop browser. Automated browser checks use mocked wake locks and a same-origin window for handoff.
