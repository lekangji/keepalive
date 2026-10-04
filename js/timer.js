function normalizeTimerPart(input, max) {
  const digits = input.value.replace(/\D/g, '').slice(0, 2);
  const value = Math.min(max, Number(digits || 0));
  input.value = String(value).padStart(2, '0');
  return value;
}

function readTimerPart(input, max) {
  const digits = input.value.replace(/\D/g, '').slice(0, 2);
  return Math.min(max, Number(digits || 0));
}

function durationFromEditor({ normalize = false } = {}) {
  const values = [
    [els.hoursInput, TIMER_PART_LIMITS.hours],
    [els.minutesInput, TIMER_PART_LIMITS.minutes],
    [els.secondsInput, TIMER_PART_LIMITS.seconds],
  ].map(([input, max]) => (normalize ? normalizeTimerPart(input, max) : readTimerPart(input, max)));

  const [hours, minutes, seconds] = values;
  return ((hours * 3600) + (minutes * 60) + seconds) * 1000;
}

function updateDurationFromEditor({ edited = true } = {}) {
  if (state.running || state.mode !== 'timer') return;
  if (!edited) return;
  state.durationMs = durationFromEditor();
  state.remainingMs = state.durationMs;
  state.hasStarted = false;
  setRingProgress(0);
  const display = formatClock(state.durationMs);
  setTimerText(display, Math.ceil(state.durationMs / 1000));
  setRunningUI(false);
  updateStatus();
  els.clockCaption.textContent = state.durationMs > 0 ? 'Set your time. Press Enter to start.' : 'Enter a duration above zero';
}

function setTimerText(text, secondsKey) {
  if (els.timerValue.textContent === text) return;
  els.timerValue.innerHTML = text.split(':').map((part) => `<span class="clock-digit">${part}</span>`).join('<span class="clock-colon" aria-hidden="true">:</span>');
  els.timerValue.setAttribute('datetime', `PT${Math.max(0, secondsKey)}S`);

  els.timerValue.classList.remove('tick');
  void els.timerValue.offsetWidth;
  els.timerValue.classList.add('tick');
}

function showTimerEditor(show) {
  els.clockEditor.hidden = !show;
  els.timerValue.hidden = show;
}

function setRingProgress(progress) {
  const clamped = Math.min(1, Math.max(0, progress));
  els.progressValue.style.strokeDashoffset = `${RING_CIRCUMFERENCE * (1 - clamped)}`;
}

function updateStatus() {
  const locked = isWakeLockActive();
  els.statusDot.classList.toggle('active', state.running && locked);
  els.statusDot.classList.toggle('error', state.running && !locked);

  if (!state.running) {
    els.statusText.textContent = state.mode === 'timer' && state.hasStarted && state.remainingMs <= 0 ? 'Finished' : state.hasStarted ? 'Paused' : 'Ready';
  } else if (locked) {
    els.statusText.textContent = 'Screen awake';
  } else {
    els.statusText.textContent = 'Wake lock released';
  }
  const floatingStatus = state.pipWindow?.document.getElementById('floatingStatus');
  if (floatingStatus) {
    floatingStatus.textContent = els.statusText.textContent;
    floatingStatus.classList.toggle('active', state.running && locked);
  }
}

