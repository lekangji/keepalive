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
    setAttribute() {}, focus() {}, querySelectorAll: () => [],
  });
  const els = Object.fromEntries(['wakeButton', 'wakeButtonText', 'restartButton', 'clockEditor', 'timerValue', 'clockWrap', 'clockLabel', 'clockCaption', 'statusDot', 'statusText', 'progressValue', 'weeklyTime', 'todayTime', 'timerShell'].map((key) => [key, element()]));
  const inputs = [element(), element(), element()];
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
    document: { visibilityState: 'visible' },
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
