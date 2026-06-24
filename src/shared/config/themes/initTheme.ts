import type { ThemeMode } from '../theme.types';
import { applyThemeMode } from './applyTheme';

const STORAGE_KEY = 'elist-theme';

function readPersistedTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 'dark';
    const parsed = JSON.parse(raw) as { state?: { theme?: string } };
    return parsed.state?.theme === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** Применить сохранённую тему до первого рендера React */
export function initTheme(): void {
  applyThemeMode(readPersistedTheme());
}
