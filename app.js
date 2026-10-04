const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const RING_RADIUS = 164;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const WEEK_STORAGE_KEY = 'keepiton-weekly-time-v2';
const LEGACY_WEEK_STORAGE_KEY = 'awake-weekly-time-v1';
const FOCUS_WARNING_KEY = 'keepiton-hide-focus-warning';
const LEGACY_FOCUS_WARNING_KEY = 'awake-hide-focus-warning';
const THEME_STORAGE_KEY = 'keepiton-theme';
const LEGACY_THEME_STORAGE_KEY = 'awake-theme';
const TIMER_PART_LIMITS = { hours: 99, minutes: 59, seconds: 59 };

const state = {
  theme: localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem(LEGACY_THEME_STORAGE_KEY) || 'system',
  mode: 'continuous',
  running: false,
  wakeLock: null,
  startedAt: 0,
  deadline: 0,
  durationMs: 30 * 60 * 1000,
  rafId: null,
  lastDisplayedSecond: null,
  hiddenWhileRunning: false,
  focusAlertShown: false,
  weekKey: '',
  weekTrackedSeconds: 0,
  trackingStartedAt: null,
  lastWeeklyRenderSecond: null,
  lastWeeklyPersistAt: 0,
};

const els = {
  html: document.documentElement,
  themeButton: $('#themeButton'),
  themeMenu: $('#themeMenu'),
  statusDot: $('#statusDot'),
  statusText: $('#statusText'),
  clockWrap: $('#clockWrap'),
  clockLabel: $('#clockLabel'),
  timerValue: $('#timerValue'),
  clockEditor: $('#clockEditor'),
  hoursInput: $('#hoursInput'),
  minutesInput: $('#minutesInput'),
  secondsInput: $('#secondsInput'),
  clockCaption: $('#clockCaption'),
  progressValue: $('#progressValue'),
  wakeButton: $('#wakeButton'),
  wakeButtonText: $('#wakeButtonText'),
  weeklyTime: $('#weeklyTime'),
};

const timerInputs = [els.hoursInput, els.minutesInput, els.secondsInput];

els.progressValue.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
els.progressValue.style.strokeDashoffset = `${RING_CIRCUMFERENCE}`;

function resolveTheme() {
  const resolved = state.theme === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : state.theme;

  els.html.dataset.theme = state.theme;
  els.html.dataset.resolvedTheme = resolved;
  $$('.theme-menu button').forEach((button) => {
    button.classList.toggle('active', button.dataset.themeChoice === state.theme);
  });
}

function setTheme(theme) {
  state.theme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  resolveTheme();
  setThemeMenuOpen(false);
}

function setThemeMenuOpen(open) {
  els.themeMenu.hidden = !open;
  els.themeButton.setAttribute('aria-expanded', String(open));
}

function formatClock(ms, round = 'ceil') {
  const secondsValue = ms / 1000;
  const totalSeconds = Math.max(0, round === 'floor' ? Math.floor(secondsValue) : Math.ceil(secondsValue));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function currentWeekKey(date = new Date()) {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  const daysSinceMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - daysSinceMonday);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const day = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function loadWeeklyTime() {
  state.weekKey = currentWeekKey();
  try {
    const saved = JSON.parse(localStorage.getItem(WEEK_STORAGE_KEY) || 'null');
    if (saved?.weekKey === state.weekKey && Number.isFinite(saved.seconds) && saved.seconds >= 0) {
      state.weekTrackedSeconds = Math.floor(saved.seconds);
    } else {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_WEEK_STORAGE_KEY) || 'null');
      if (legacy?.weekKey === state.weekKey && Number.isFinite(legacy.ms) && legacy.ms >= 0) {
        state.weekTrackedSeconds = Math.floor(legacy.ms / 1000);
        persistWeeklyTime();
      }
    }
  } catch (_) {
    state.weekTrackedSeconds = 0;
  }
  renderWeeklyTime(Date.now(), true);
}

function ensureCurrentWeek(now = Date.now()) {
  const key = currentWeekKey(new Date(now));
  if (key === state.weekKey) return;

  state.weekKey = key;
  state.weekTrackedSeconds = 0;
  state.trackingStartedAt = isActivelyTracking() ? now : null;
  persistWeeklyTime(now);
}

function isWakeLockActive() {
  return Boolean(state.wakeLock && !state.wakeLock.released);
}

function isActivelyTracking() {
  return state.running && document.visibilityState === 'visible' && isWakeLockActive();
}

function beginTracking(now = Date.now()) {
  ensureCurrentWeek(now);
  if (state.trackingStartedAt === null && isActivelyTracking()) {
    state.trackingStartedAt = now;
  }
}

function commitTracking(now = Date.now()) {
  ensureCurrentWeek(now);
  if (state.trackingStartedAt !== null) {
    // Store whole tracked seconds so the weekly counter advances on the exact
    // same second boundaries as the active timer instead of drifting by ms.
    state.weekTrackedSeconds += Math.floor(Math.max(0, now - state.trackingStartedAt) / 1000);
    state.trackingStartedAt = null;
  }
  persistWeeklyTime(now);
  renderWeeklyTime(now, true);
}

function getWeeklySeconds(now = Date.now()) {
  ensureCurrentWeek(now);
  const liveSeconds = state.trackingStartedAt === null
    ? 0
    : Math.floor(Math.max(0, now - state.trackingStartedAt) / 1000);
  return state.weekTrackedSeconds + liveSeconds;
}

function persistWeeklyTime(now = Date.now()) {
  localStorage.setItem(WEEK_STORAGE_KEY, JSON.stringify({
    weekKey: state.weekKey,
    seconds: getWeeklySeconds(now),
  }));
  state.lastWeeklyPersistAt = now;
}

function renderWeeklyTime(now = Date.now(), force = false) {
  const second = getWeeklySeconds(now);
  if (!force && second === state.lastWeeklyRenderSecond) return;
  state.lastWeeklyRenderSecond = second;
  els.weeklyTime.textContent = formatClock(second * 1000, 'floor');
}

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

function updateDurationFromEditor() {
  if (state.running || state.mode !== 'timer') return;
  state.durationMs = durationFromEditor();
  const display = formatClock(state.durationMs);
  els.timerValue.textContent = display;
  els.timerValue.setAttribute('datetime', `PT${Math.ceil(state.durationMs / 1000)}S`);
  els.clockCaption.textContent = state.durationMs > 0 ? 'Type a duration, then start' : 'Enter a duration above zero';
}

function setTimerText(text, secondsKey) {
  if (els.timerValue.textContent === text) return;
  els.timerValue.textContent = text;
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
    els.statusText.textContent = 'Ready';
  } else if (locked) {
    els.statusText.textContent = 'Screen awake';
  } else {
    els.statusText.textContent = 'Paused';
  }
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) throw new Error('Wake Lock is not supported in this browser.');
  if (document.visibilityState !== 'visible') throw new Error('This page must be visible to keep the screen awake.');

  const lock = await navigator.wakeLock.request('screen');
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
  commitTracking(Date.now());
  if (!state.wakeLock) {
    updateStatus();
    return;
  }

  const lock = state.wakeLock;
  state.wakeLock = null;
  try { await lock.release(); } catch (_) {}
  updateStatus();
}

function renderFrame() {
  if (!state.running) return;

  // requestAnimationFrame passes a performance.now() timestamp, while our
  // start/deadline values use Date.now(). Never mix those two clock domains.
  const now = Date.now();

  if (state.mode === 'continuous') {
    const elapsed = Math.max(0, now - state.startedAt);
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
  state.rafId = requestAnimationFrame(renderFrame);
}

function startAnimationLoop() {
  cancelAnimationFrame(state.rafId);
  state.lastDisplayedSecond = null;
  state.rafId = requestAnimationFrame(renderFrame);
}

function stopAnimationLoop() {
  cancelAnimationFrame(state.rafId);
  state.rafId = null;
}

function setRunningUI(running) {
  els.wakeButton.classList.toggle('running', running);
  els.wakeButtonText.textContent = running ? 'Stop' : 'Keep screen awake';
  $$('.mode-button').forEach((button) => { button.disabled = running; });
  timerInputs.forEach((input) => { input.disabled = running; });

  if (running) {
    showTimerEditor(false);
    els.clockCaption.textContent = state.mode === 'timer'
      ? 'Screen stays awake until the countdown ends'
      : 'Screen stays awake until you stop it';
  } else {
    showTimerEditor(state.mode === 'timer');
    els.clockCaption.textContent = state.mode === 'timer'
      ? 'Type a duration, then start'
      : 'Ready when you are';
  }
}

async function start() {
  if (state.mode === 'timer') {
    state.durationMs = durationFromEditor({ normalize: true });
    if (state.durationMs <= 0) {
      els.clockCaption.textContent = 'Enter a duration above zero';
      els.minutesInput.focus();
      return;
    }
  }

  try {
    await requestWakeLock();
  } catch (error) {
    els.clockCaption.textContent = error.message || 'Could not start a screen wake lock.';
    updateStatus();
    if (window.Swal) {
      Swal.fire({
        customClass: { popup: 'keepiton-alert' },
        icon: 'error',
        title: 'Could not keep the screen awake',
        text: error.message || 'Your browser refused the wake lock request.',
        confirmButtonText: 'OK',
      });
    }
    return;
  }

  state.running = true;
  state.startedAt = Date.now();
  state.deadline = state.mode === 'timer' ? state.startedAt + state.durationMs : 0;
  state.hiddenWhileRunning = false;
  beginTracking(state.startedAt);

  els.clockWrap.classList.toggle('counting-down', state.mode === 'timer');
  if (state.mode === 'timer') {
    setRingProgress(0);
    setTimerText(formatClock(state.durationMs), Math.ceil(state.durationMs / 1000));
  } else {
    setTimerText('00:00:00', 0);
  }

  setRunningUI(true);
  updateStatus();
  startAnimationLoop();
}

async function stop({ preserveTimer = false } = {}) {
  if (!state.running && !preserveTimer) return;

  state.running = false;
  stopAnimationLoop();
  await releaseWakeLock();
  els.clockWrap.classList.remove('counting-down');
  setRingProgress(0);
  setRunningUI(false);

  if (!preserveTimer) {
    if (state.mode === 'timer') {
      state.durationMs = durationFromEditor({ normalize: true });
      setTimerText(formatClock(state.durationMs), Math.ceil(state.durationMs / 1000));
    } else {
      setTimerText('00:00:00', 0);
    }
  }

  state.startedAt = 0;
  state.deadline = 0;
  state.lastDisplayedSecond = null;
  updateStatus();
  renderWeeklyTime(Date.now(), true);
}

async function finishTimer() {
  if (!state.running) return;

  state.running = false;
  stopAnimationLoop();
  await releaseWakeLock();
  els.clockWrap.classList.remove('counting-down');
  setRingProgress(1);
  setTimerText('00:00:00', 0);
  setRunningUI(false);
  els.clockCaption.textContent = 'Timer finished';
  updateStatus();

  if (window.Swal) {
    Swal.fire({
      customClass: { popup: 'keepiton-alert' },
      icon: 'success',
      title: 'Timer finished',
      text: 'The wake lock has been released.',
      confirmButtonText: 'Done',
    });
  }
}

function setMode(mode) {
  if (state.running || mode === state.mode) return;
  state.mode = mode;

  $$('.mode-button').forEach((button) => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
  });

  els.clockLabel.textContent = mode === 'timer' ? 'TIME REMAINING' : 'INFINITE';
  els.clockCaption.textContent = mode === 'timer' ? 'Type a duration, then start' : 'Ready when you are';
  els.clockWrap.classList.remove('counting-down');
  setRingProgress(0);

  if (mode === 'timer') {
    state.durationMs = durationFromEditor();
    showTimerEditor(true);
  } else {
    showTimerEditor(false);
    setTimerText('00:00:00', 0);
  }
}

async function showFocusWarning() {
  if (
    !state.running
    || state.focusAlertShown
    || !window.Swal
    || localStorage.getItem(FOCUS_WARNING_KEY) === 'true'
    || localStorage.getItem(LEGACY_FOCUS_WARNING_KEY) === 'true'
  ) return;

  state.focusAlertShown = true;
  try {
    const result = await Swal.fire({
      customClass: { popup: 'keepiton-alert' },
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

els.themeButton.addEventListener('click', (event) => {
  event.stopPropagation();
  setThemeMenuOpen(els.themeMenu.hidden);
});

$$('.theme-menu button').forEach((button) => {
  button.addEventListener('click', () => setTheme(button.dataset.themeChoice));
});

document.addEventListener('click', (event) => {
  if (!els.themeMenu.contains(event.target) && !els.themeButton.contains(event.target)) {
    setThemeMenuOpen(false);
  }
});

$$('.mode-button').forEach((button) => {
  button.addEventListener('click', () => setMode(button.dataset.mode));
});

timerInputs.forEach((input, index) => {
  const key = input.id.replace('Input', '');
  const max = TIMER_PART_LIMITS[key];

  input.addEventListener('focus', () => input.select());

  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D/g, '').slice(0, 2);
    input.value = digits;
    if (digits.length === 2 && index < timerInputs.length - 1) {
      timerInputs[index + 1].focus();
    }
    updateDurationFromEditor();
  });

  input.addEventListener('blur', () => {
    normalizeTimerPart(input, max);
    updateDurationFromEditor();
  });

  input.addEventListener('keydown', (event) => {
    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? selectionStart;
    const hasSelection = selectionStart !== selectionEnd;

    if (event.key === 'ArrowRight' && !hasSelection && selectionEnd === input.value.length && index < timerInputs.length - 1) {
      event.preventDefault();
      const nextInput = timerInputs[index + 1];
      nextInput.focus();
      nextInput.setSelectionRange(0, 0);
      return;
    }

    if (event.key === 'ArrowLeft' && !hasSelection && selectionStart === 0 && index > 0) {
      event.preventDefault();
      const previousInput = timerInputs[index - 1];
      previousInput.focus();
      const caret = previousInput.value.length;
      previousInput.setSelectionRange(caret, caret);
      return;
    }

    // Backspace should flow naturally across HH:MM:SS. Once the current
    // segment is empty (or the caret is already at its start), continue
    // deleting from the end of the previous segment instead of getting stuck.
    if (event.key === 'Backspace' && !hasSelection && selectionStart === 0 && index > 0) {
      event.preventDefault();
      const previousInput = timerInputs[index - 1];
      previousInput.value = previousInput.value.slice(0, -1);
      previousInput.focus();
      const caret = previousInput.value.length;
      previousInput.setSelectionRange(caret, caret);
      updateDurationFromEditor();
      return;
    }

    // Delete mirrors Backspace in the other direction, so editing can move
    // through the entire timer without requiring a click into each segment.
    if (event.key === 'Delete' && !hasSelection && selectionEnd === input.value.length && index < timerInputs.length - 1) {
      event.preventDefault();
      const nextInput = timerInputs[index + 1];
      nextInput.value = nextInput.value.slice(1);
      nextInput.focus();
      nextInput.setSelectionRange(0, 0);
      updateDurationFromEditor();
    }
  });
});

els.wakeButton.addEventListener('click', () => {
  if (state.running) stop();
  else start();
});

// Browsers may release the lock when the page becomes hidden. Pause weekly
// tracking immediately, then re-acquire the lock when the page is visible again.
document.addEventListener('visibilitychange', async () => {
  if (!state.running) return;

  if (document.visibilityState === 'hidden') {
    state.hiddenWhileRunning = true;
    commitTracking(Date.now());
    stopAnimationLoop();
    return;
  }

  if (state.mode === 'timer' && Date.now() >= state.deadline) {
    finishTimer();
    return;
  }

  if (!state.wakeLock) {
    try {
      await requestWakeLock();
    } catch (_) {
      updateStatus();
    }
  }

  beginTracking(Date.now());
  startAnimationLoop();

  if (state.hiddenWhileRunning) {
    state.hiddenWhileRunning = false;
    showFocusWarning();
  }
});

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.theme === 'system') resolveTheme();
});

window.addEventListener('pagehide', () => {
  commitTracking(Date.now());
  if (state.wakeLock) state.wakeLock.release().catch(() => {});
});

window.addEventListener('beforeunload', () => {
  commitTracking(Date.now());
});

resolveTheme();
loadWeeklyTime();
showTimerEditor(false);
setMode('continuous');

if (!('wakeLock' in navigator)) {
  els.clockCaption.textContent = 'This browser does not support the Screen Wake Lock API.';
  els.statusDot.classList.add('error');
  els.statusText.textContent = 'Unsupported';
}
