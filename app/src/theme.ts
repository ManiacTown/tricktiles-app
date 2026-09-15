const THEME_KEY = 'tricktiles_dark_mode';

export function isDarkMode(): boolean {
  return localStorage.getItem(THEME_KEY) === 'true';
}

function applyTheme(dark: boolean): void {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

export function setDarkMode(dark: boolean): void {
  localStorage.setItem(THEME_KEY, String(dark));
  applyTheme(dark);
}

// Applied once as soon as this module loads (imported at the top of
// main.tsx, before the app renders) — so the saved preference takes
// effect immediately rather than flashing light mode first, then
// switching to dark a moment later.
applyTheme(isDarkMode());
