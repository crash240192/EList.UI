// shared/lib/lazyWithRetry.ts
// После деплоя старый JS в вкладке может ссылаться на удалённые CSS/JS-чанки.
// Один раз перезагружаем страницу, чтобы подтянуть актуальный index.html и ассеты.

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const RELOAD_KEY = 'elist_chunk_reload';

function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('preload CSS')
    || msg.includes('Loading chunk')
    || msg.includes('Failed to fetch dynamically imported module')
    || msg.includes('error loading dynamically imported module')
    || msg.includes('Importing a module script failed')
  );
}

export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const module = await factory();
      sessionStorage.removeItem(RELOAD_KEY);
      return module;
    } catch (error) {
      if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
        return new Promise(() => { /* ждём reload */ });
      }
      sessionStorage.removeItem(RELOAD_KEY);
      throw error;
    }
  });
}
