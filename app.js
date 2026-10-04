function showPage() {
  const about = window.location.hash === '#about';
  document.getElementById('timerPage').hidden = about;
  document.getElementById('aboutPage').hidden = !about;
  document.querySelectorAll('.page-nav a').forEach((link) => {
    if (link.hash === (about ? '#about' : '#timer')) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  if (about) document.getElementById('aboutTitle').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', showPage);
showPage();

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
