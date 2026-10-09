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
    updateDurationFromEditor({ edited: false });
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      timerInputs.forEach((part) => normalizeTimerPart(part, TIMER_PART_LIMITS[part.id.replace('Input', '')]));
      start();
      return;
    }
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

els.restartButton.addEventListener('click', restart);
els.floatingButton.addEventListener('click', toggleFloatingWindow);
$('#returnButton').addEventListener('click', () => state.pipWindow?.close());

async function handleTimerKeydown(event) {
  if (event.key !== ' ' || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey
    || !isSessionVisible()
    || event.target.closest('input, textarea, select, button, a, summary, [contenteditable], [role="dialog"], .swal2-container')) return;
  event.preventDefault();
  if (event.repeat || state.busy) return;
  if (state.running) await stop();
  else await start();
}

document.addEventListener('keydown', handleTimerKeydown);

// Pause the session while its controls are hidden; resume when they return.
document.addEventListener('visibilitychange', handleVisibilityChange);

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.theme === 'system') resolveTheme();
});

window.addEventListener('pagehide', () => {
  state.pageHidden = true;
  state.lockRequestId += 1;
  handleVisibilityChange();
  state.pipWindow?.close();
});

window.addEventListener('pageshow', () => {
  state.pageHidden = false;
  handleVisibilityChange();
});

window.addEventListener('beforeunload', () => {
  commitTracking(Date.now());
});

