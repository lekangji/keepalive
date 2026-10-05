async function requestVideoWakeLock() {
  if (!window.NoSleep) throw new Error('NoSleep.js could not load. Check your connection and reload to use the video fallback.');
  const noSleep = new window.NoSleep();
  // Older iOS uses page refreshes instead of video; only enable the video path.
  if (!noSleep.noSleepVideo) throw new Error('This browser does not support the video wake-lock fallback.');
  noSleep.noSleepVideo.muted = true;
  try {
    await noSleep.enable();
  } catch (error) {
    noSleep.disable();
    throw error;
  }
  return {
    fallback: true,
    get released() { return !noSleep.isEnabled || noSleep.noSleepVideo.paused; },
    async release() { noSleep.disable(); },
    addEventListener(type, listener) {
      if (type === 'release') noSleep.noSleepVideo.addEventListener('pause', listener);
    },
  };
}

async function requestWakeLock() {
  const owner = activeDocument();
  const browser = owner.defaultView.navigator;
  if (owner.visibilityState !== 'visible') throw new Error('Keep the tab or floating window visible, then try again.');
  const requestId = ++state.lockRequestId;
  const lock = 'wakeLock' in browser
    ? await browser.wakeLock.request('screen')
    : await requestVideoWakeLock();
  if (requestId !== state.lockRequestId || owner !== activeDocument() || owner.visibilityState !== 'visible') {
    await lock.release();
    throw new Error('The active window changed. Try again.');
  }
  state.wakeLock = lock;
  lock.addEventListener('release', () => {
    if (state.wakeLock === lock) {
      commitTracking(Date.now());
      state.wakeLock = null;
    }
    updateStatus();
  });
  updateStatus();
  beginTracking(Date.now());
}

async function releaseWakeLock() {
  state.lockRequestId += 1;
  commitTracking(Date.now());
  const lock = state.wakeLock;
  state.wakeLock = null;
  if (lock) {
    try { await lock.release(); } catch (_) {}
  }
  updateStatus();
}

async function handleVisibilityChange() {
  renderWeeklyTime(Date.now());
  if (!state.running) return;
  if (activeDocument().visibilityState === 'hidden') {
    state.hiddenWhileRunning = true;
    commitTracking(Date.now());
    stopAnimationLoop();
    if (state.wakeLock?.fallback) await releaseWakeLock();
    return;
  }
  if (state.mode === 'timer' && Date.now() >= state.deadline) {
    await finishTimer();
    return;
  }
  if (!isWakeLockActive()) {
    try { await requestWakeLock(); } catch (_) { updateStatus(); }
  }
  beginTracking(Date.now());
  startAnimationLoop();
  if (state.hiddenWhileRunning) {
    state.hiddenWhileRunning = false;
    showFocusWarning();
  }
}
