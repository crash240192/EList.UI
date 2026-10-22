// shared/lib/yandexMetrika.ts — счётчик из index.html + hit при SPA-навигации

/** Должен совпадать с id в index.html (Yandex.Metrika). */
export const YANDEX_METRIKA_ID = 113735562;

declare global {
  interface Window {
    ym?: (id: number, method: string, ...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/** Просмотр «страницы» при client-side переходах React Router (History API). */
export function trackMetrikaHit(url?: string): void {
  if (typeof window.ym !== 'function') return;
  const target = url ?? `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.ym(YANDEX_METRIKA_ID, 'hit', target);
}
