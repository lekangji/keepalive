// Document Picture-in-Picture provides a real always-on-top browser window.
// Move the existing controls so both windows share one session and one counter.
async function toggleFloatingWindow() {
  if (state.pipWindow) {
    state.pipWindow.close();
    return;
  }
  if (!window.documentPictureInPicture) {
    els.clockCaption.textContent = 'Floating windows need a browser with Document Picture-in-Picture, such as Chrome or Edge.';
    return;
  }
  if (state.busy) return;
  els.floatingButton.disabled = true;
  let floating;
  try {
    floating = await window.documentPictureInPicture.requestWindow({ width: 380, height: 540 });
    await releaseWakeLock();
    stopAnimationLoop();
    state.pipWindow = floating;
    const doc = floating.document;
    doc.title = 'keepalive';
    doc.documentElement.dataset.theme = state.theme;
    doc.documentElement.dataset.resolvedTheme = els.html.dataset.resolvedTheme;
    // Flatten local CSS imports so the first floating frame is already styled.
    const stylesheet = doc.createElement('style');
    const rules = (sheet) => [...sheet.cssRules].map((rule) => rule.styleSheet ? rules(rule.styleSheet) : rule.cssText).join('\n');
    stylesheet.textContent = [...document.styleSheets].map(rules).join('\n');
    doc.head.append(stylesheet);
    doc.body.className = 'floating-view';
    const header = doc.createElement('header');
    header.className = 'floating-header';
    const brand = document.querySelector('.brand').cloneNode(true);
    brand.href = new URL('index.html', location.href).href;
    brand.querySelector('img').src = new URL('assets/coffee.svg', location.href).href;
    brand.addEventListener('click', (event) => { event.preventDefault(); floating.close(); });
    header.append(brand);
    const status = doc.createElement('span');
    status.className = 'floating-status';
    status.id = 'floatingStatus';
    header.append(status);
    doc.body.append(header, els.timerShell);
    els.floatingPlaceholder.hidden = false;
    els.floatingButton.querySelector('span').textContent = 'Return to tab';
    doc.addEventListener('visibilitychange', handleVisibilityChange);
    doc.addEventListener('keydown', handleTimerKeydown);
    floating.addEventListener('pagehide', async () => {
      stopAnimationLoop();
      await releaseWakeLock();
      document.querySelector('.main-stage').prepend(els.timerShell);
      state.pipWindow = null;
      els.floatingPlaceholder.hidden = true;
      els.floatingButton.querySelector('span').textContent = 'Open floating window';
      await handleVisibilityChange();
    }, { once: true });
    await handleVisibilityChange();
    updateStatus();
  } catch (error) {
    floating?.close();
    els.clockCaption.textContent = error.message || 'Could not open a floating window. Try again.';
  } finally {
    els.floatingButton.disabled = false;
  }
}
