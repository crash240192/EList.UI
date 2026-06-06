// shared/lib/adConfig.ts — настройки рекламных блоков

/** ID блока РСЯ из partner.yandex.ru */
export const YANDEX_AD_BLOCK_ID = (import.meta.env.VITE_YANDEX_AD_BLOCK_ID ?? '').trim();

/** Вставлять рекламную карточку каждые N мероприятий в списке */
export const AD_EVERY_N_EVENTS = 10;

export const AD_PLACEHOLDER_TEXT = 'Тут могла быть ваша реклама';

export function isYandexAdsScriptReady(): boolean {
  return typeof window !== 'undefined' && !!(window as Window & { Ya?: { Context?: { AdvManager?: unknown } } }).Ya?.Context?.AdvManager;
}

/** Живая реклама — только если задан blockId и загружен скрипт context.js */
export function shouldRenderLiveAd(blockId: string = YANDEX_AD_BLOCK_ID): boolean {
  return Boolean(blockId) && isYandexAdsScriptReady();
}

export function shouldInsertAdAfterIndex(index: number, every = AD_EVERY_N_EVENTS): boolean {
  return (index + 1) % every === 0;
}
