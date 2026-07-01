/** Семантические CSS-токены цветовой схемы (мапятся на --bg, --accent и т.д.) */
export interface ThemeTokens {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  accent: string;
  accentHover: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  success: string;
  danger: string;
  warning: string;
}

export interface ThemePack {
  id: string;
  label: string;
  dark: ThemeTokens;
  light: ThemeTokens;
}

export type ThemeMode = 'dark' | 'light';
