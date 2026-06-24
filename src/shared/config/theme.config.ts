/**
 * Активная пара цветовых схем для переключателя тёмная/светлая.
 *
 * При развёртывании задайте VITE_THEME_PACK в .env.local:
 *   VITE_THEME_PACK=default   — текущие фиолетово-серые темы
 *   VITE_THEME_PACK=ocean     — бирюзово-синие
 *   VITE_THEME_PACK=sunset    — тёплые янтарные
 *
 * Чтобы добавить свою схему: создайте папку в themes/ с dark.ts и light.ts,
 * зарегистрируйте в themes/registry.ts и укажите id в VITE_THEME_PACK.
 */
import type { ThemePack } from './theme.types';
import { themePacks, type ThemePackId } from './themes/registry';

const configuredPack = (import.meta.env.VITE_THEME_PACK ?? 'default') as ThemePackId;

export function getActiveThemePack(): ThemePack {
  const pack = themePacks[configuredPack];
  if (!pack) {
    console.warn(`[theme] Unknown VITE_THEME_PACK="${configuredPack}", using "default"`);
    return themePacks.default;
  }
  return pack;
}

export const ACTIVE_THEME_PACK_ID = getActiveThemePack().id;
