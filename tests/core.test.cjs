const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

function session() {
  let now = new Date('2026-10-04T12:00:00').getTime();
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const element = () => ({
    value: '00', textContent: '', hidden: false, style: {},
    classList: { toggle() {}, remove() {}, add() {} },
    setAttribute() {}, focus() {}, addEventListener() {}, querySelectorAll: () => [],
  });
  const els = Object.fromEntries(['wakeButton', 'wakeButtonText', 'restartButton', 'clockEditor', 'timerValue', 'clockWrap', 'clockLabel', 'clockCaption', 'statusDot', 'statusText', 'progressValue', 'weeklyTime', 'todayTime', 'timerShell'].map((key) => [key, element()]));
  const inputs = [element(), element(), element()];
  inputs.forEach((input, index) => { input.id = ['hoursInput', 'minutesInput', 'secondsInput'][index]; });
  [els.hoursInput, els.minutesInput, els.secondsInput] = inputs;
  inputs[1].value = '01';
  const storage = new Map();
  const alerts = [];
  const context = vm.createContext({
    Date: Clock, Math, Number, String, Boolean, Object, JSON,
    els, timerInputs: inputs, $$: () => [],
    RING_CIRCUMFERENCE: 100, TIMER_PART_LIMITS: { hours: 99, minutes: 59, seconds: 59 },
    WEEK_STORAGE_KEY: 'keepalive-activity-v1', PREVIOUS_WEEK_STORAGE_KEY: 'keepiton-weekly-time-v2',
    LEGACY_WEEK_STORAGE_KEY: 'awake-weekly-time-v1', FOCUS_WARNING_KEY: 'focus', LEGACY_FOCUS_WARNING_KEY: 'old-focus',
    state: {
      mode: 'timer', running: false, busy: false, hasStarted: false,
      durationMs: 60000, remainingMs: 60000, elapsedMs: 0,
      pipWindow: null, activityDays: {}, carryWeek: null,
      trackingStartedAt: null, wakeLock: null, lockRequestId: 0,
    },
    document: { visibilityState: 'visible', getElementById: () => ({ hidden: false }) },
    localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    requestWakeLock: async () => { context.state.wakeLock = { released: false }; },
    releaseWakeLock: async () => { context.commitTracking(now); context.state.wakeLock = null; },
    window: { Swal: true }, Swal: { fire: async (options) => { alerts.push(options); return {}; } },
  });
  context.window.requestAnimationFrame = () => 1;
  context.window.cancelAnimationFrame = () => {};
  context.state.animationWindow = context.window;
  for (const file of ['format', 'tracking', 'timer', 'session']) {
    vm.runInContext(readFileSync(join(__dirname, '..', 'js', `${file}.js`), 'utf8'), context);
  }
  context.isSessionVisible = () => context.activeDocument().visibilityState === 'visible' && (Boolean(context.state.pipWindow) || !context.document.getElementById('timerPage').hidden);
  return { context, alerts, storage, advance: (ms) => { now += ms; }, setNow: (value) => { now = new Date(value).getTime(); } };
}

test('pause/resume preserves remaining time; focusing or blurring does not restart', async () => {
  const { context: c, advance } = session();
  await c.start();
  advance(20000);
  await c.stop();
  assert.equal(c.state.remainingMs, 40000);
  assert.equal(c.els.secondsInput.value, '40');
  c.updateDurationFromEditor({ edited: false });
  assert.equal(c.state.durationMs, 60000);
  assert.equal(c.state.remainingMs, 40000);
  advance(10000);
  await c.start();
  assert.equal(c.state.deadline - c.Date.now(), 40000);
});

test('editing duration and explicit Restart reset the timer', async () => {
  const { context: c, advance } = session();
  await c.start();
  advance(20000);
  await c.stop();
  await c.restart();
  assert.equal(c.state.remainingMs, 60000);
  assert.equal(c.state.running, false);
  c.els.minutesInput.value = '02';
  c.updateDurationFromEditor();
  assert.equal(c.state.remainingMs, 120000);
  assert.equal(c.state.durationMs, 120000);
  assert.equal(c.state.hasStarted, false);
  await c.start();
  advance(5000);
  await c.restart();
  assert.equal(c.state.running, true);
  assert.equal(c.state.deadline - c.Date.now(), 120000);
});

test('finished timer requires an edit or Restart; only timer mode shows alerts', async () => {
  const { context: c, alerts, advance } = session();
  await c.start();
  advance(65000);
  await c.finishTimer();
  assert.equal(c.state.remainingMs, 0);
  assert.equal(alerts.length, 1);
  assert.equal(c.activityTotals(c.Date.now()).today, 60000);
  await c.start();
  assert.equal(c.state.running, false);
  c.setMode('continuous');
  c.requestWakeLock = async () => { throw new Error('Denied'); };
  await c.start();
  assert.equal(alerts.length, 1);
  c.state.running = true;
  await c.showFocusWarning();
  assert.equal(alerts.length, 1);
});

test('infinite mode resumes elapsed time', async () => {
  const { context: c, advance } = session();
  c.setMode('continuous');
  await c.start();
  advance(10000);
  await c.stop();
  advance(30000);
  await c.start();
  advance(5000);
  await c.stop();
  assert.equal(c.state.elapsedMs, 15000);
});

test('daily and weekly counters split at midnight and Monday, showing hours/minutes', () => {
  const { context: c, setNow, advance } = session();
  setNow('2026-10-04T23:59:30');
  c.state.running = true;
  c.state.wakeLock = { released: false };
  c.beginTracking();
  advance(90000);
  c.commitTracking();
  assert.equal(c.state.activityDays['2026-10-04'], 30000);
  assert.equal(c.state.activityDays['2026-10-05'], 60000);
  assert.equal(c.activityTotals(c.Date.now()).week, 60000);
  assert.equal(c.els.todayTime.textContent, '0h 01m');
  assert.equal(c.els.weeklyTime.textContent, '0h 01m');
  assert.equal(c.formatActivity(7380000), '2h 03m');
});

test('old weekly totals migrate without inventing today totals', () => {
  const { context: c, storage } = session();
  storage.set('keepiton-weekly-time-v2', JSON.stringify({ weekKey: c.currentWeekKey(), seconds: 3660 }));
  c.loadWeeklyTime();
  assert.equal(c.els.weeklyTime.textContent, '1h 01m');
  assert.equal(c.els.todayTime.textContent, '0h 00m');
});

function videoSession() {
  const fixture = session();
  const c = fixture.context;
  c.window.navigator = {};
  c.document.defaultView = c.window;
  const players = [];
  c.window.NoSleep = class {
    constructor() {
      this.isEnabled = false;
      this.noSleepVideo = { paused: true, addEventListener: (_, listener) => { this.onPause = listener; } };
      players.push(this);
    }
    async enable() { this.isEnabled = true; this.noSleepVideo.paused = false; }
    disable() { this.isEnabled = false; this.noSleepVideo.paused = true; this.onPause?.(); }
  };
  vm.runInContext(readFileSync(join(__dirname, '..', 'js', 'wake-lock.js'), 'utf8'), c);
  return { ...fixture, players };
}

test('video fallback starts, tracks time, stops on pause, and resumes', async () => {
  const { context: c, players, advance } = videoSession();
  await c.start();
  assert.equal(c.state.running, true);
  assert.equal(players[0].isEnabled, true);
  assert.equal(c.isWakeLockActive(), true);
  advance(10000);
  await c.stop();
  assert.equal(players[0].isEnabled, false);
  assert.equal(c.activityTotals(c.Date.now()).today, 10000);
  await c.start();
  assert.equal(c.state.running, true);
  assert.equal(c.isWakeLockActive(), true);
  await c.finishTimer();
  assert.equal(c.isWakeLockActive(), false);
  assert.equal(players[1].isEnabled, false);
});

test('video fallback is released while hidden and reacquired when visible', async () => {
  const { context: c, players, advance } = videoSession();
  await c.start();
  advance(10000);
  c.document.visibilityState = 'hidden';
  await c.handleVisibilityChange();
  assert.equal(c.state.running, false);
  assert.equal(c.state.remainingMs, 50000);
  assert.equal(players[0].isEnabled, false);
  assert.equal(c.isWakeLockActive(), false);
  advance(120000);
  c.document.visibilityState = 'visible';
  await c.handleVisibilityChange();
  assert.equal(c.state.running, true);
  assert.equal(c.state.deadline - c.Date.now(), 50000);
  assert.equal(c.activityTotals(c.Date.now()).today, 10000);
  assert.equal(c.isWakeLockActive(), true);
});

test('internal navigation pauses Infinite; manual pause never auto-resumes', async () => {
  const { context: c, advance } = videoSession();
  const timerPage = { hidden: false };
  c.document.getElementById = () => timerPage;
  c.setMode('continuous');
  await c.start();
  advance(5000);
  timerPage.hidden = true;
  await c.handleVisibilityChange();
  assert.equal(c.state.running, false);
  assert.equal(c.state.elapsedMs, 5000);
  advance(30000);
  timerPage.hidden = false;
  await c.handleVisibilityChange();
  assert.equal(c.state.running, true);
  advance(2000);
  await c.stop();
  assert.equal(c.state.elapsedMs, 7000);
  timerPage.hidden = true;
  await c.handleVisibilityChange();
  timerPage.hidden = false;
  await c.handleVisibilityChange();
  assert.equal(c.state.running, false);
});

test('returning before wake lock release completes still resumes automatically', async () => {
  const { context: c } = videoSession();
  await c.start();
  let completeRelease;
  c.state.wakeLock.release = () => new Promise((resolve) => { completeRelease = resolve; });
  c.document.visibilityState = 'hidden';
  const pause = c.handleVisibilityChange();
  c.document.visibilityState = 'visible';
  await c.handleVisibilityChange();
  completeRelease();
  await pause;
  assert.equal(c.state.running, true);
  assert.equal(c.isWakeLockActive(), true);
});

test('visible floating timer keeps running when the main page is hidden', async () => {
  const { context: c } = videoSession();
  await c.start();
  c.state.pipWindow = { document: { visibilityState: 'visible' }, ...c.window };
  c.document.visibilityState = 'hidden';
  c.document.getElementById = () => ({ hidden: true });
  await c.handleVisibilityChange();
  assert.equal(c.state.running, true);
});

test('spacebar toggles the session once and preserves normal control shortcuts', async () => {
  const { context: c } = session();
  const listeners = {};
  c.document.addEventListener = (type, listener) => { listeners[type] = listener; };
  c.window.addEventListener = () => {};
  c.matchMedia = () => ({ addEventListener() {} });
  c.toggleFloatingWindow = () => {};
  c.handleVisibilityChange = () => {};
  c.$ = () => ({ addEventListener() {} });
  c.els.themeButton = c.els.themeMenu = c.els.floatingButton = { addEventListener() {} };
  vm.runInContext(readFileSync(join(__dirname, '..', 'js', 'events.js'), 'utf8'), c);
  let prevented = 0;
  const event = { key: ' ', target: { closest: () => null }, preventDefault: () => { prevented += 1; } };
  await listeners.keydown(event);
  assert.equal(c.state.running, true);
  await listeners.keydown({ ...event, repeat: true });
  assert.equal(c.state.running, true);
  await listeners.keydown(event);
  assert.equal(c.state.running, false);
  assert.equal(prevented, 3);
  for (const control of ['input', 'textarea', 'select', 'button', 'a', 'summary', '[contenteditable]', '[role="dialog"]']) {
    await listeners.keydown({ ...event, target: { closest: (selector) => selector.includes(control) ? {} : null } });
    assert.equal(c.state.running, false);
  }
  c.document.getElementById = () => ({ hidden: true });
  await listeners.keydown(event);
  assert.equal(c.state.running, false);
});

test('browser history restoration resumes a paused session', async () => {
  const { context: c, advance } = videoSession();
  const listeners = {};
  c.document.addEventListener = () => {};
  c.window.addEventListener = (type, listener) => { listeners[type] = listener; };
  c.matchMedia = () => ({ addEventListener() {} });
  c.toggleFloatingWindow = () => {};
  c.$ = () => ({ addEventListener() {} });
  c.els.themeButton = c.els.themeMenu = c.els.floatingButton = { addEventListener() {} };
  vm.runInContext(readFileSync(join(__dirname, '..', 'js', 'events.js'), 'utf8'), c);
  await c.start();
  advance(10000);
  listeners.pagehide();
  assert.equal(c.state.running, false);
  assert.equal(c.state.remainingMs, 50000);
  await c.handleVisibilityChange();
  advance(120000);
  listeners.pageshow();
  // Drain the wake-lock request and release microtasks.
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
  assert.equal(c.state.running, true);
  assert.equal(c.state.deadline - c.Date.now(), 50000);
});

test('navigation during a pending wake-lock request defers start until return', async () => {
  const { context: c } = videoSession();
  let grantLock;
  let released = false;
  c.window.navigator.wakeLock = { request: () => new Promise((resolve) => { grantLock = resolve; }) };
  const starting = c.start();
  c.document.visibilityState = 'hidden';
  await c.handleVisibilityChange();
  grantLock({ released: false, release: async () => { released = true; }, addEventListener() {} });
  await starting;
  assert.equal(released, true);
  assert.equal(c.state.running, false);
  assert.equal(c.state.resumeOnReturn, true);
  c.window.navigator.wakeLock.request = async () => ({ released: false, release: async () => {}, addEventListener() {} });
  c.document.visibilityState = 'visible';
  await c.handleVisibilityChange();
  assert.equal(c.state.running, true);
});

test('missing NoSleep or rejected video playback does not start the timer', async () => {
  const { context: c } = videoSession();
  c.window.NoSleep = undefined;
  await c.start();
  assert.equal(c.state.running, false);
  assert.match(c.els.clockCaption.textContent, /NoSleep/);
  c.window.NoSleep = class {
    constructor() { this.noSleepVideo = {}; }
    async enable() { throw new Error('Playback denied'); }
    disable() {}
  };
  await c.start();
  assert.equal(c.state.running, false);
  assert.match(c.els.clockCaption.textContent, /Playback denied/);
});

test('native wake lock is preferred and denial is reported without video fallback', async () => {
  const { context: c, players } = videoSession();
  let released = false;
  c.window.navigator.wakeLock = { request: async () => ({ released: false, addEventListener() {}, release: async () => { released = true; } }) };
  await c.start();
  assert.equal(c.state.running, true);
  assert.equal(players.length, 0);
  await c.stop();
  assert.equal(released, true);
  c.window.navigator.wakeLock.request = async () => { throw new Error('Permission denied'); };
  await c.start();
  assert.equal(c.state.running, false);
  assert.equal(players.length, 0);
  assert.match(c.els.clockCaption.textContent, /Permission denied/);
});
