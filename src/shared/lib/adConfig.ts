// shared/lib/adConfig.ts — настройки рекламных блоков

/** ID блока РСЯ из partner.yandex.ru (лента R-A-20290944-1) */
export const YANDEX_AD_BLOCK_ID = (import.meta.env.VITE_YANDEX_AD_BLOCK_ID ?? 'R-A-20290944-1').trim();

/** Тип блока в AdvManager.render — «feed» для R-A-20290944-1 */
export const YANDEX_AD_RENDER_TYPE = 'feed' as const;

/** Вставлять рекламную карточку каждые N мероприятий в списке */
export const AD_EVERY_N_EVENTS = 10;

export const AD_PLACEHOLDER_TEXT = 'Тут могла быть ваша реклама';

type YaWindow = Window & {
  yaContextCb?: Array<() => void>;
  Ya?: { Context?: { AdvManager?: unknown } };
};

export function isYandexAdsScriptReady(): boolean {
  return typeof window !== 'undefined' && !!(window as YaWindow).Ya?.Context?.AdvManager;
}

/** Живая реклама — если задан blockId (скрипт подхватывается через yaContextCb) */
export function shouldRenderLiveAd(blockId: string = YANDEX_AD_BLOCK_ID): boolean {
  return Boolean(blockId);
}

export function shouldInsertAdAfterIndex(index: number, every = AD_EVERY_N_EVENTS): boolean {
  return (index + 1) % every === 0;
}

/** Поставить render в очередь РСЯ (официальный паттерн с yaContextCb) */
export function enqueueYandexAdRender(opts: {
  blockId: string;
  renderTo: string;
  type?: typeof YANDEX_AD_RENDER_TYPE;
}): void {
  if (typeof window === 'undefined') return;
  const win = window as YaWindow & {
    Ya?: { Context?: { AdvManager?: { render: (o: object) => void } } };
  };
  win.yaContextCb = win.yaContextCb || [];
  win.yaContextCb.push(() => {
    win.Ya?.Context?.AdvManager?.render({
      blockId: opts.blockId,
      renderTo: opts.renderTo,
      type: opts.type ?? YANDEX_AD_RENDER_TYPE,
    });
  });
}
