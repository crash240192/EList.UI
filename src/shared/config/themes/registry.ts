import type { ThemePack } from '../theme.types';
import { dark as defaultDark } from './default/dark';
import { light as defaultLight } from './default/light';
import { dark as oceanDark } from './ocean/dark';
import { light as oceanLight } from './ocean/light';
import { dark as sunsetDark } from './sunset/dark';
import { light as sunsetLight } from './sunset/light';

export const defaultThemePack: ThemePack = {
  id: 'default',
  label: 'Default (indigo)',
  dark: defaultDark,
  light: defaultLight,
};

export const oceanThemePack: ThemePack = {
  id: 'ocean',
  label: 'Ocean (cyan)',
  dark: oceanDark,
  light: oceanLight,
};

export const sunsetThemePack: ThemePack = {
  id: 'sunset',
  label: 'Sunset (amber)',
  dark: sunsetDark,
  light: sunsetLight,
};

/** Все доступные пары цветовых схем */
export const themePacks = {
  default: defaultThemePack,
  ocean: oceanThemePack,
  sunset: sunsetThemePack,
} as const;

export type ThemePackId = keyof typeof themePacks;
