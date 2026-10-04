async function requestWakeLock() {
  const owner = activeDocument();
  const browser = owner.defaultView.navigator;
  if (!('wakeLock' in browser)) throw new Error('Wake Lock is not supported in this browser.');
  if (owner.visibilityState !== 'visible') throw new Error('Keep the tab or floating window visible, then try again.');
  const requestId = ++state.lockRequestId;
  const lock = await browser.wakeLock.request('screen');
  if (requestId !== state.lockRequestId || owner !== activeDocument()) {
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
