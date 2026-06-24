import { getActiveThemePack } from '../theme.config';
import type { ThemeMode, ThemeTokens } from '../theme.types';

const TOKEN_CSS_VARS: Record<keyof ThemeTokens, string> = {
  bg: '--bg',
  surface: '--surface',
  surface2: '--surface-2',
  border: '--border',
  accent: '--accent',
  accentHover: '--accent-hover',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  textMuted: '--text-muted',
  success: '--success',
  danger: '--danger',
  warning: '--warning',
};

export function applyThemeTokens(target: HTMLElement, tokens: ThemeTokens): void {
  (Object.entries(TOKEN_CSS_VARS) as [keyof ThemeTokens, string][]).forEach(([key, cssVar]) => {
    target.style.setProperty(cssVar, tokens[key]);
  });
}

export function applyThemeMode(mode: ThemeMode): void {
  const pack = getActiveThemePack();
  const tokens = mode === 'light' ? pack.light : pack.dark;
  applyThemeTokens(document.documentElement, tokens);
  document.body.classList.toggle('light-theme', mode === 'light');
}
