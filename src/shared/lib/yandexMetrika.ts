// shared/lib/yandexMetrika.ts — согласие на cookies + отложенная загрузка Метрики

import { cookies } from '@/shared/lib/cookies';

/** Счётчик Яндекс.Метрики (актуальный id из кабинета). */
export const YANDEX_METRIKA_ID = 113787433;

/** Локальное согласие на аналитические / необязательные cookies. */
export const COOKIE_CONSENT_KEY = 'elist_cookie_consent';

type YmFn = ((...args: unknown[]) => void) & {
  a?: unknown[][];
  l?: number;
};

declare global {
  interface Window {
    ym?: YmFn;
    dataLayer?: unknown[];
  }
}

let metrikaStarted = false;

export function hasCookieConsent(): boolean {
  try {
    if (localStorage.getItem(COOKIE_CONSENT_KEY) === '1') return true;
  } catch {
    /* private mode */
  }
  return cookies.get(COOKIE_CONSENT_KEY) === '1';
}

export function acceptCookieConsent(): void {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, '1');
  } catch {
    /* ignore */
  }
  cookies.set(COOKIE_CONSENT_KEY, '1', 365);
  initYandexMetrika();
}

/**
 * Загружает tag.js и инициализирует счётчик (только после согласия).
 * Идемпотентно.
 */
export function initYandexMetrika(): void {
  if (metrikaStarted || typeof window === 'undefined') return;
  if (!hasCookieConsent()) return;
  metrikaStarted = true;

  const id = YANDEX_METRIKA_ID;
  const src = `https://mc.yandex.ru/metrika/tag.js?id=${id}`;

  // Официальный loader Яндекса (очередь до загрузки tag.js)
  if (typeof window.ym !== 'function') {
    const queue: YmFn = function (...args: unknown[]) {
      (queue.a = queue.a || []).push(args);
    };
    queue.a = [];
    queue.l = Date.now();
    window.ym = queue;
  }

  const already = Array.from(document.scripts).some((s) => s.src === src);
  if (!already) {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    const first = document.getElementsByTagName('script')[0];
    first?.parentNode?.insertBefore(script, first);
  }

  window.ym?.(id, 'init', {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: 'dataLayer',
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true,
  });
}

/** Просмотр «страницы» при client-side переходах React Router. */
export function trackMetrikaHit(url?: string): void {
  if (typeof window.ym !== 'function') return;
  const target = url ?? `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.ym(YANDEX_METRIKA_ID, 'hit', target);
}
