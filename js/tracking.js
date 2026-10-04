// Activity is measured only while a visible document holds a screen wake lock.
// Store milliseconds so brief pauses do not discard partial minutes.
function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function currentWeekKey(date = new Date()) {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return dayKey(monday);
}

function loadWeeklyTime() {
  try {
    const saved = JSON.parse(localStorage.getItem(WEEK_STORAGE_KEY) || 'null');
    if (saved?.days && typeof saved.days === 'object' && !Array.isArray(saved.days)) {
      state.activityDays = Object.fromEntries(Object.entries(saved.days).filter(([key, ms]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(ms) && ms >= 0));
      if (saved.carryWeek && Number.isFinite(saved.carryWeek.ms) && saved.carryWeek.ms >= 0) state.carryWeek = saved.carryWeek;
    } else {
      // Earlier versions saved weekly totals without dates. Preserve this week's
      // total, but do not invent a daily breakdown for those older sessions.
      const previous = JSON.parse(localStorage.getItem(PREVIOUS_WEEK_STORAGE_KEY) || 'null');
      const legacy = JSON.parse(localStorage.getItem(LEGACY_WEEK_STORAGE_KEY) || 'null');
      const old = previous?.weekKey === currentWeekKey() ? { key: previous.weekKey, ms: previous.seconds * 1000 } : { key: legacy?.weekKey, ms: legacy?.ms };
      if (old.key === currentWeekKey() && Number.isFinite(old.ms) && old.ms >= 0) state.carryWeek = old;
    }
  } catch (_) {
    state.activityDays = {};
  }
  renderWeeklyTime(Date.now(), true);
}

function isWakeLockActive() {
  return Boolean(state.wakeLock && !state.wakeLock.released);
}

function activeDocument() {
  return state.pipWindow?.document || document;
}

function isActivelyTracking() {
  return state.running && activeDocument().visibilityState === 'visible' && isWakeLockActive();
}

function beginTracking(now = Date.now()) {
  if (state.trackingStartedAt === null && isActivelyTracking()) state.trackingStartedAt = now;
}

function addInterval(days, start, end) {
  // Split at local midnight, including Monday rollover and daylight-saving days.
  while (start < end) {
    const date = new Date(start);
    const nextDay = new Date(date);
    nextDay.setHours(24, 0, 0, 0);
    const stop = Math.min(end, nextDay.getTime());
    const key = dayKey(date);
    days[key] = (days[key] || 0) + stop - start;
    start = stop;
  }
}

function commitTracking(now = Date.now()) {
  if (state.trackingStartedAt !== null) {
    addInterval(state.activityDays, state.trackingStartedAt, now);
    state.trackingStartedAt = null;
  }
  persistWeeklyTime(now);
  renderWeeklyTime(now, true);
}

function activitySnapshot(now) {
  const days = { ...state.activityDays };
  if (state.trackingStartedAt !== null) addInterval(days, state.trackingStartedAt, now);
  return days;
}

function activityTotals(now) {
  const days = activitySnapshot(now);
  const today = dayKey(new Date(now));
  const week = currentWeekKey(new Date(now));
  const carry = state.carryWeek?.key === week ? state.carryWeek.ms : 0;
  return {
    today: days[today] || 0,
    week: Object.entries(days).reduce((sum, [key, ms]) => sum + (key >= week && key <= today ? ms : 0), carry),
  };
}

function persistWeeklyTime(now = Date.now()) {
  try {
    localStorage.setItem(WEEK_STORAGE_KEY, JSON.stringify({ days: activitySnapshot(now), carryWeek: state.carryWeek }));
  } catch (_) {
    // The active session still works if browser storage is unavailable or full.
  }
  state.lastWeeklyPersistAt = now;
}

function formatActivity(ms) {
  const minutes = Math.floor(Math.max(0, ms) / 60000);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

function renderWeeklyTime(now = Date.now()) {
  const totals = activityTotals(now);
  const today = formatActivity(totals.today);
  const week = formatActivity(totals.week);
  if (els.todayTime.textContent !== today) els.todayTime.textContent = today;
  if (els.weeklyTime.textContent !== week) els.weeklyTime.textContent = week;
}
