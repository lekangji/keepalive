function resolveTheme() {
  const resolved = state.theme === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : state.theme;

  els.html.dataset.theme = state.theme;
  els.html.dataset.resolvedTheme = resolved;
  if (state.pipWindow) {
    state.pipWindow.document.documentElement.dataset.theme = state.theme;
    state.pipWindow.document.documentElement.dataset.resolvedTheme = resolved;
  }
  $$('.theme-menu button').forEach((button) => {
    button.classList.toggle('active', button.dataset.themeChoice === state.theme);
  });
}

function setTheme(theme) {
  state.theme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  resolveTheme();
  setThemeMenuOpen(false);
}

function setThemeMenuOpen(open) {
  els.themeMenu.hidden = !open;
  els.themeButton.setAttribute('aria-expanded', String(open));
}

