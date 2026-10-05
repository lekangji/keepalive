function showPage() {
  const page = ['about', 'privacy', 'terms'].includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'timer';
  ['timer', 'about', 'privacy', 'terms'].forEach((name) => {
    document.getElementById(`${name}Page`).hidden = name !== page;
  });
  document.querySelectorAll('.page-nav a').forEach((link) => {
    if (link.hash === `#${page}`) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  if (page !== 'timer') document.getElementById(`${page}Title`).focus({ preventScroll: true });
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
  document.getElementById('wakeFallbackNotice').hidden = false;
}
