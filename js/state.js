const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector), ...(state.pipWindow ? state.pipWindow.document.querySelectorAll(selector) : [])];

const RING_RADIUS = 164;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const WEEK_STORAGE_KEY = 'keepalive-activity-v1';
const PREVIOUS_WEEK_STORAGE_KEY = 'keepiton-weekly-time-v2';
const LEGACY_WEEK_STORAGE_KEY = 'awake-weekly-time-v1';
const FOCUS_WARNING_KEY = 'keepalive-hide-focus-warning';
const LEGACY_FOCUS_WARNING_KEY = 'awake-hide-focus-warning';
const THEME_STORAGE_KEY = 'keepalive-theme';
const LEGACY_THEME_STORAGE_KEY = 'awake-theme';
const TIMER_PART_LIMITS = { hours: 99, minutes: 59, seconds: 59 };

const state = {
  theme: localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem('keepiton-theme') || localStorage.getItem(LEGACY_THEME_STORAGE_KEY) || 'system',
  mode: 'continuous',
  running: false,
  wakeLock: null,
  startedAt: 0,
  deadline: 0,
  durationMs: 30 * 60 * 1000,
  remainingMs: 30 * 60 * 1000,
  elapsedMs: 0,
  hasStarted: false,
  busy: false,
  pipWindow: null,
  animationWindow: window,
  lockRequestId: 0,
  rafId: null,
  lastDisplayedSecond: null,
  resumeOnReturn: false,
  pageHidden: false,
  focusAlertShown: false,
  trackingStartedAt: null,
  lastWeeklyPersistAt: 0,
  activityDays: {},
  carryWeek: null,
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
  todayTime: $('#todayTime'),
  restartButton: $('#restartButton'),
  floatingButton: $('#floatingButton'),
  floatingPlaceholder: $('#floatingPlaceholder'),
  timerShell: $('.timer-shell'),
};

const timerInputs = [els.hoursInput, els.minutesInput, els.secondsInput];

els.progressValue.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
els.progressValue.style.strokeDashoffset = `${RING_CIRCUMFERENCE}`;

