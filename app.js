resolveTheme();
loadWeeklyTime();
// Refresh calendar totals even when a paused page stays open past midnight.
setInterval(() => renderWeeklyTime(Date.now()), 60000);
showTimerEditor(false);
setRunningUI(false);

if (!('wakeLock' in navigator)) {
  els.clockCaption.textContent = 'This browser does not support the Screen Wake Lock API.';
  els.statusDot.classList.add('error');
  els.statusText.textContent = 'Unsupported';
}
