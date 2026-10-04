function renderFrame() {
  if (!state.running) return;

  // requestAnimationFrame passes a performance.now() timestamp, while our
  // start/deadline values use Date.now(). Never mix those two clock domains.
  const now = Date.now();

  if (state.mode === 'continuous') {
    const elapsed = state.elapsedMs + Math.max(0, now - state.startedAt);
    const displaySecond = Math.floor(elapsed / 1000);
    if (displaySecond !== state.lastDisplayedSecond) {
      state.lastDisplayedSecond = displaySecond;
      setTimerText(formatClock(elapsed, 'floor'), displaySecond);
    }
  } else {
    const remaining = Math.max(0, state.deadline - now);
    const displaySecond = Math.ceil(remaining / 1000);
    const progress = state.durationMs > 0 ? 1 - (remaining / state.durationMs) : 1;

    // Keep ring progress frame-synced; only the text changes once per second.
    setRingProgress(progress);
    if (displaySecond !== state.lastDisplayedSecond) {
      state.lastDisplayedSecond = displaySecond;
      setTimerText(formatClock(remaining), displaySecond);
    }

    if (remaining <= 0) {
      finishTimer();
      return;
    }
  }

  renderWeeklyTime(now);
  if (now - state.lastWeeklyPersistAt >= 5000) persistWeeklyTime(now);
  state.rafId = state.animationWindow.requestAnimationFrame(renderFrame);
}

function startAnimationLoop() {
  state.animationWindow.cancelAnimationFrame(state.rafId);
  state.animationWindow = state.pipWindow || window;
  state.lastDisplayedSecond = null;
  state.rafId = state.animationWindow.requestAnimationFrame(renderFrame);
}

function stopAnimationLoop() {
  state.animationWindow.cancelAnimationFrame(state.rafId);
  state.rafId = null;
}

function setRunningUI(running) {
  els.wakeButton.classList.toggle('running', running);
  els.wakeButton.disabled = state.busy;
  els.wakeButtonText.textContent = running ? 'Pause' : state.hasStarted ? 'Resume' : 'Keep screen awake';
  els.restartButton.hidden = state.mode !== 'timer';
  els.restartButton.disabled = state.busy;
  $$('.mode-button').forEach((button) => { button.disabled = running || state.busy; });
  timerInputs.forEach((input) => { input.disabled = running || state.busy; });
  showTimerEditor(!running && state.mode === 'timer');
  els.clockWrap.classList.toggle('counting-down', state.mode === 'timer' && state.hasStarted);
  els.clockCaption.textContent = running
    ? 'A little coffee for your screen.'
    : state.hasStarted ? 'Paused. Pick up where you left off.'
    : state.mode === 'timer' ? 'Set your time. Press Enter to start.' : 'Ready when you are';
}

async function start() {
  if (state.running || state.busy) return;
  if (state.mode === 'timer' && state.remainingMs <= 0) {
    els.clockCaption.textContent = state.hasStarted ? 'Timer finished. Edit the time or click Restart.' : 'Enter a duration above zero';
    els.minutesInput.focus();
    return;
  }
  state.busy = true;
  setRunningUI(false);
  try {
    await requestWakeLock();
    state.startedAt = Date.now();
    state.deadline = state.mode === 'timer' ? state.startedAt + state.remainingMs : 0;
    state.running = true;
    state.hasStarted = true;
    state.hiddenWhileRunning = false;
    beginTracking(state.startedAt);
    setTimerText(formatClock(state.mode === 'timer' ? state.remainingMs : state.elapsedMs, state.mode === 'timer' ? 'ceil' : 'floor'), Math.ceil((state.mode === 'timer' ? state.remainingMs : state.elapsedMs) / 1000));
    startAnimationLoop();
  } catch (error) {
    state.busy = false;
    setRunningUI(false);
    els.clockCaption.textContent = error.message || 'Could not start a screen wake lock.';
    updateStatus();
    if (state.mode === 'timer' && window.Swal) {
      Swal.fire({ target: activeDocument().body, customClass: { popup: 'keepalive-alert' }, icon: 'error', title: 'Could not keep the screen awake', text: error.message || 'Your browser refused the wake lock request.', confirmButtonText: 'OK' });
    }
    return;
  }
  state.busy = false;
  setRunningUI(true);
  updateStatus();
}

async function stop() {
  if (!state.running || state.busy) return;
  const now = Date.now();
  if (state.mode === 'timer') state.remainingMs = Math.max(0, state.deadline - now);
  else state.elapsedMs += Math.max(0, now - state.startedAt);
  state.running = false;
  state.busy = true;
  stopAnimationLoop();
  setRunningUI(false);
  await releaseWakeLock();
  state.busy = false;
  setRunningUI(false);
  setTimerText(formatClock(state.mode === 'timer' ? state.remainingMs : state.elapsedMs, state.mode === 'timer' ? 'ceil' : 'floor'), Math.ceil((state.mode === 'timer' ? state.remainingMs : state.elapsedMs) / 1000));
  if (state.mode === 'timer') syncEditorToRemaining();
  updateStatus();
  renderWeeklyTime(now, true);
}

function syncEditorToRemaining() {
  formatClock(state.remainingMs).split(':').forEach((part, index) => { timerInputs[index].value = part; });
}

async function restart() {
  if (state.busy || state.mode !== 'timer') return;
  const wasRunning = state.running;
  if (wasRunning) await stop();
  state.remainingMs = state.durationMs;
  state.hasStarted = false;
  syncEditorToRemaining();
  setRingProgress(0);
  setTimerText(formatClock(state.remainingMs), Math.ceil(state.remainingMs / 1000));
  setRunningUI(false);
  updateStatus();
  if (wasRunning) await start();
}

async function finishTimer() {
  if (!state.running) return;
  // Commit only through the deadline, even if a hidden page renders late.
  commitTracking(Math.min(Date.now(), state.deadline));
  state.running = false;
  state.remainingMs = 0;
  state.busy = true;
  stopAnimationLoop();
  setRunningUI(false);
  await releaseWakeLock();
  state.busy = false;
  syncEditorToRemaining();
  setRunningUI(false);
  setRingProgress(1);
  setTimerText('00:00:00', 0);
  els.wakeButtonText.textContent = 'Timer finished';
  els.clockCaption.textContent = 'Timer finished. Edit the time or click Restart.';
  updateStatus();
  if (state.mode === 'timer' && window.Swal) {
    Swal.fire({ target: activeDocument().body, customClass: { popup: 'keepalive-alert' }, icon: 'success', title: 'Timer finished', text: 'The wake lock has been released.', confirmButtonText: 'Done' });
  }
}

function setMode(mode) {
  if (state.running || state.busy || mode === state.mode) return;
  state.mode = mode;
  state.hasStarted = mode === 'timer' ? state.remainingMs !== state.durationMs : state.elapsedMs > 0;
  els.timerShell.querySelectorAll('.mode-button').forEach((button) => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  els.clockLabel.textContent = mode === 'timer' ? 'TIME REMAINING' : 'INFINITE';
  setRunningUI(false);
  setRingProgress(mode === 'timer' && state.durationMs > 0 ? 1 - state.remainingMs / state.durationMs : 0);
  if (mode === 'timer') syncEditorToRemaining();
  setTimerText(formatClock(mode === 'timer' ? state.remainingMs : state.elapsedMs), Math.ceil((mode === 'timer' ? state.remainingMs : state.elapsedMs) / 1000));
  updateStatus();
}

async function showFocusWarning() {
  if (
    !state.running
    || state.mode !== 'timer'
    || Boolean(state.pipWindow)
    || state.focusAlertShown
    || !window.Swal
    || localStorage.getItem(FOCUS_WARNING_KEY) === 'true'
    || localStorage.getItem('keepiton-hide-focus-warning') === 'true'
    || localStorage.getItem(LEGACY_FOCUS_WARNING_KEY) === 'true'
  ) return;

  state.focusAlertShown = true;
  try {
    const result = await Swal.fire({
      target: activeDocument().body,
      customClass: { popup: 'keepalive-alert' },
      icon: 'warning',
      title: 'Keep this page visible',
      html: 'I can only keep your screen awake while this page is <strong>visible</strong>. Your browser pauses or releases the wake lock when you switch away.',
      input: 'checkbox',
      inputValue: 0,
      inputPlaceholder: "Don’t warn me again",
      confirmButtonText: 'Got it',
    });

    if (result.isConfirmed && result.value) {
      localStorage.setItem(FOCUS_WARNING_KEY, 'true');
    }
  } finally {
    state.focusAlertShown = false;
  }
}

