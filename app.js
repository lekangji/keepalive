const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const RING_RADIUS = 164;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const state = {
  theme: localStorage.getItem('awake-theme') || 'system', mode: 'continuous', running: false,
  wakeLock: null, startedAt: 0, durationMs: 1800000, remainingMs: 0, elapsedMs: 0,
  rafId: null, lastDisplayedSecond: null, pausedForVisibility: false,
};
const els = {
  html: document.documentElement, themeButton: $('#themeButton'), themeMenu: $('#themeMenu'),
  statusDot: $('#statusDot'), statusText: $('#statusText'), timerSettings: $('#timerSettings'),
  durationInput: $('#durationInput'), clockWrap: $('#clockWrap'), clockLabel: $('#clockLabel'),
  timerValue: $('#timerValue'), clockCaption: $('#clockCaption'), progressValue: $('#progressValue'),
  wakeButton: $('#wakeButton'), wakeButtonText: $('#wakeButtonText'), supportNote: $('#supportNote'),
};
els.progressValue.style.strokeDasharray = RING_CIRCUMFERENCE;
els.progressValue.style.strokeDashoffset = RING_CIRCUMFERENCE;

function resolveTheme() {
  const resolved = state.theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : state.theme;
  els.html.dataset.theme = state.theme; els.html.dataset.resolvedTheme = resolved;
  $$('.theme-menu button').forEach((b) => b.classList.toggle('active', b.dataset.themeChoice === state.theme));
}
function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60].map((n) => String(n).padStart(2, '0')).join(':');
}
function formatDurationInput(ms) {
  const total = Math.round(ms / 1000), h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return [h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(' ') || '1s';
}
function durationFromControl({ normalize = true } = {}) {
  const value = els.durationInput.value.trim().toLowerCase(), clock = value.match(/^(\d{1,3}):([0-5]\d)(?::([0-5]\d))?$/);
  let ms = 0;
  if (clock) {
    const [, first, second, third] = clock;
    ms = (third ? Number(first) * 3600 + Number(second) * 60 + Number(third) : Number(first) * 60 + Number(second)) * 1000;
  } else {
    const units = [...value.matchAll(/(\d+(?:\.\d+)?)\s*(h(?:ours?)?|m(?:in(?:utes?)?)?|s(?:ec(?:onds?)?)?)/g)];
    if (units.length && units.map((u) => u[0]).join('').replace(/\s/g, '') === value.replace(/\s/g, '')) {
      ms = units.reduce((sum, [, amount, unit]) => sum + Number(amount) * (unit.startsWith('h') ? 3600000 : unit.startsWith('m') ? 60000 : 1000), 0);
    } else if (/^\d+$/.test(value)) ms = Number(value) * 60000;
  }
  ms = Math.min(359990000, Math.max(1000, ms || 1800000));
  if (normalize) els.durationInput.value = formatDurationInput(ms);
  return ms;
}
function setTimerText(text, seconds) {
  if (els.timerValue.textContent === text) return;
  els.timerValue.textContent = text; els.timerValue.dateTime = `PT${Math.max(0, seconds)}S`;
  els.timerValue.classList.remove('tick'); void els.timerValue.offsetWidth; els.timerValue.classList.add('tick');
}
function setRingProgress(progress) { els.progressValue.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress))); }
function updateStatus() {
  const locked = Boolean(state.wakeLock && !state.wakeLock.released), paused = state.running && state.pausedForVisibility;
  els.statusDot.classList.toggle('active', state.running && locked); els.statusDot.classList.toggle('error', state.running && !locked && !paused);
  els.statusText.textContent = !state.running ? 'Ready' : paused || !locked ? 'Paused' : 'Screen awake';
}
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) throw new Error('Screen Lock is not supported in this browser.');
  if (document.visibilityState !== 'visible') throw new Error('This page must be visible to keep the screen awake.');
  const lock = await navigator.wakeLock.request('screen'); state.wakeLock = lock;
  lock.addEventListener('release', () => { if (state.wakeLock === lock) state.wakeLock = null; updateStatus(); }); updateStatus();
}
async function releaseWakeLock() { const lock = state.wakeLock; state.wakeLock = null; if (lock) try { await lock.release(); } catch (_) {} updateStatus(); }
function stopAnimationLoop() { cancelAnimationFrame(state.rafId); state.rafId = null; }
function renderFrame(now = Date.now()) {
  if (!state.running || state.pausedForVisibility) return;
  if (state.mode === 'continuous') {
    const elapsed = state.elapsedMs + now - state.startedAt, second = Math.floor(elapsed / 1000);
    if (second !== state.lastDisplayedSecond) { state.lastDisplayedSecond = second; setTimerText(formatClock(elapsed), second); }
  } else {
    const remaining = Math.max(0, state.remainingMs - (now - state.startedAt)), second = Math.ceil(remaining / 1000);
    setRingProgress(1 - remaining / state.durationMs);
    if (second !== state.lastDisplayedSecond) { state.lastDisplayedSecond = second; setTimerText(formatClock(remaining), second); }
    if (!remaining) { finishTimer(); return; }
  }
  state.rafId = requestAnimationFrame(() => renderFrame(Date.now()));
}
function startAnimationLoop() { stopAnimationLoop(); state.lastDisplayedSecond = null; renderFrame(); }
function setRunningUI(running) {
  els.wakeButton.classList.toggle('running', running); els.wakeButtonText.textContent = running ? 'Stop' : 'Keep screen awake';
  $$('.mode-button').forEach((b) => { b.disabled = running; }); els.durationInput.disabled = running;
}
async function start() {
  if (state.mode === 'timer') { state.durationMs = durationFromControl(); state.remainingMs = state.durationMs; }
  try { await requestWakeLock(); } catch (error) { els.supportNote.classList.add('error'); els.supportNote.textContent = error.message || 'Could not start Screen Lock.'; updateStatus(); return; }
  state.running = true; state.startedAt = Date.now(); state.elapsedMs = 0; state.pausedForVisibility = false;
  els.supportNote.classList.remove('error'); els.supportNote.textContent = 'The timer pauses when you leave this tab.';
  els.clockCaption.textContent = state.mode === 'timer' ? 'Screen stays awake until the timer ends' : 'Screen stays awake until you stop it';
  els.clockWrap.classList.toggle('counting-down', state.mode === 'timer'); els.clockWrap.classList.remove('paused'); if (state.mode === 'timer') setRingProgress(0);
  setRunningUI(true); updateStatus(); startAnimationLoop();
}
async function stop() {
  if (!state.running) return; state.running = false; state.pausedForVisibility = false; stopAnimationLoop(); await releaseWakeLock();
  els.clockWrap.classList.remove('counting-down', 'paused'); setRingProgress(0); setRunningUI(false); els.supportNote.classList.remove('error'); els.supportNote.textContent = 'Ready when you are.';
  if (state.mode === 'timer') { state.durationMs = durationFromControl(); setTimerText(formatClock(state.durationMs), Math.ceil(state.durationMs / 1000)); } else setTimerText('00:00:00', 0);
  state.startedAt = 0; state.remainingMs = 0; state.elapsedMs = 0; state.lastDisplayedSecond = null; updateStatus();
}
async function finishTimer() {
  if (!state.running) return; state.running = false; stopAnimationLoop(); await releaseWakeLock(); els.clockWrap.classList.remove('counting-down', 'paused'); setRingProgress(1); setTimerText('00:00:00', 0); setRunningUI(false);
  els.clockCaption.textContent = 'Timer finished'; els.supportNote.textContent = 'Timer finished. Your normal display settings apply again.'; updateStatus();
  if (window.Swal) Swal.fire({ customClass: { popup: 'awake-alert' }, icon: 'success', title: 'Timer finished', text: 'The screen lock has been released.', confirmButtonText: 'Done' });
}
function setMode(mode) {
  if (state.running || mode === state.mode) return; state.mode = mode;
  $$('.mode-button').forEach((b) => { const selected = b.dataset.mode === mode; b.classList.toggle('active', selected); b.setAttribute('aria-selected', String(selected)); });
  els.timerSettings.hidden = mode !== 'timer'; els.clockLabel.textContent = mode === 'timer' ? 'TIME REMAINING' : 'AWAKE FOR'; els.clockCaption.textContent = mode === 'timer' ? 'Set a duration, then start' : 'Ready when you are'; setRingProgress(0);
  if (mode === 'timer') { state.durationMs = durationFromControl(); setTimerText(formatClock(state.durationMs), Math.ceil(state.durationMs / 1000)); } else setTimerText('00:00:00', 0);
}
function refreshConfiguredDuration() { if (state.running || state.mode !== 'timer') return; state.durationMs = durationFromControl({ normalize: false }); setTimerText(formatClock(state.durationMs), Math.ceil(state.durationMs / 1000)); }

els.themeButton.addEventListener('click', (e) => { e.stopPropagation(); els.themeMenu.hidden = !els.themeMenu.hidden; });
$$('.theme-menu button').forEach((b) => b.addEventListener('click', () => { state.theme = b.dataset.themeChoice; localStorage.setItem('awake-theme', state.theme); resolveTheme(); els.themeMenu.hidden = true; }));
document.addEventListener('click', (e) => { if (!els.themeMenu.contains(e.target) && !els.themeButton.contains(e.target)) els.themeMenu.hidden = true; });
$$('.mode-button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
els.durationInput.addEventListener('input', refreshConfiguredDuration);
els.durationInput.addEventListener('blur', () => { if (!state.running && state.mode === 'timer') { state.durationMs = durationFromControl(); setTimerText(formatClock(state.durationMs), Math.ceil(state.durationMs / 1000)); } });
els.wakeButton.addEventListener('click', () => state.running ? stop() : start());
document.addEventListener('visibilitychange', async () => {
  if (!state.running) return;
  if (document.visibilityState === 'hidden') {
    if (state.mode === 'timer') { state.remainingMs = Math.max(0, state.remainingMs - (Date.now() - state.startedAt)); setRingProgress(1 - state.remainingMs / state.durationMs); setTimerText(formatClock(state.remainingMs), Math.ceil(state.remainingMs / 1000)); }
    else state.elapsedMs += Date.now() - state.startedAt;
    state.pausedForVisibility = true; stopAnimationLoop(); await releaseWakeLock(); els.clockWrap.classList.add('paused'); els.clockCaption.textContent = 'Paused while this tab is away'; els.supportNote.textContent = 'Return to this tab to resume the timer.'; updateStatus(); return;
  }
  if (!state.pausedForVisibility) return;
  try { await requestWakeLock(); } catch (_) { els.supportNote.classList.add('error'); els.supportNote.textContent = 'Unable to resume Screen Lock. Try starting again.'; return; }
  state.startedAt = Date.now(); state.pausedForVisibility = false; els.clockWrap.classList.remove('paused'); els.clockCaption.textContent = state.mode === 'timer' ? 'Screen stays awake until the timer ends' : 'Screen stays awake until you stop it'; els.supportNote.classList.remove('error'); els.supportNote.textContent = 'The timer pauses when you leave this tab.'; updateStatus(); startAnimationLoop();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state.theme === 'system') resolveTheme(); });
window.addEventListener('beforeunload', () => { if (state.wakeLock) state.wakeLock.release().catch(() => {}); });
resolveTheme(); setMode('continuous');
if (!('wakeLock' in navigator)) { els.supportNote.classList.add('error'); els.supportNote.textContent = 'Screen Lock is not supported in this browser.'; }
