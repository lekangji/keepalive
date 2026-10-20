<p align="center">
  <img src="assets/coffee.svg" alt="" width="80" height="80" />
</p>

<h1 align="center">keepalive</h1>

<p align="center">A little coffee for your screen.</p>

<p align="center">
  <a href="https://keepalive.lekangji.cc/">Try it online</a> ·
  <a href="#run-locally">Run locally</a>
</p>

Keep a recipe, presentation, dashboard, or long read on screen without repeatedly waking your device. Open keepalive, start a session, and leave it visible. No account or installation needed.

## Pick your pace

- **Infinite:** Keep your screen awake for as long as you need, with a clock counting up.
- **Timer:** Set hours, minutes, and seconds directly in the clock. The wake lock releases when the countdown ends.
- **Pause and resume:** Pick up where you left off in either mode. Switching away pauses the session; returning resumes it automatically. A session you pause yourself stays paused.
- **Floating window:** Move the controls into an always-on-top window in browsers that support Document Picture-in-Picture. Keep it visible while you work in another tab.
- **Activity totals:** See time kept awake today and this week, saved in your browser. Only time with a visible, active wake lock counts. Days roll over at local midnight; weeks start Monday.
- **Your preferred theme:** Choose light, dark, or follow your system.

## Get started

1. Open [keepalive](https://keepalive.lekangji.cc/).
2. Choose **Infinite**, or select **Timer** and enter a duration.
3. Click **Keep screen awake**. In Timer mode, you can also press **Enter** from a time field.

Use **Pause** and **Resume** to control the session. Press **Space** when focus is outside an input, button, link, or dialog to toggle it from the keyboard.

In Timer mode, **Restart** restores the original duration and continues immediately if the timer was running. Editing the duration starts a fresh countdown.

Select **Open floating window** to move the same session into a smaller window. Close it or choose **Return to tab** to bring the controls back.

## Before you leave it running

Keep the timer tab or floating window visible. Hiding the active window pauses the session and releases the wake lock. Closing the floating window returns the controls to the main tab; the session resumes when that tab is visible.

keepalive uses your browser's native screen wake lock when available. Otherwise, it shows a notice before using [NoSleep.js](https://github.com/richtr/NoSleep.js) to play a silent background video. The fallback stops when you pause, the timer finishes, or the active page is hidden, and may use more battery. Browser permissions, playback restrictions, and power-saving settings can affect either method.

When a countdown finishes, your normal display and sleep settings take over. keepalive does not turn off your screen or shut down your computer.

## Run locally

The site is plain HTML, CSS, and JavaScript, with no build step. From the project directory, start a static server with Python:

```bash
python -m http.server 8000
```

Open [localhost:8000](http://localhost:8000). Use localhost for development or HTTPS when hosting the site so the browser can request a screen wake lock.

NoSleep.js and SweetAlert2 load from jsDelivr, so those features need access to the CDN.

## Privacy

Your activity totals and preferences stay in browser storage. There is no account or analytics tracking. The hosting provider and jsDelivr receive normal web requests and may keep access logs under their own policies.

Read the [privacy policy](https://keepalive.lekangji.cc/#privacy) and [terms of service](https://keepalive.lekangji.cc/#terms) on the site.

## Tests

Run the regression tests with Node.js; no dependency installation is needed:

```bash
node --test tests/core.test.cjs
```

Actual sleep prevention and always-on-top placement need a manual check on your device in a supporting browser. Mocked wake locks cannot verify those behaviors.
