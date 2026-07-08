/** Пропорции обложки в модалке предпросмотра (EventModal) */
export const EVENT_PREVIEW_HERO_WIDTH = 400;
export const EVENT_PREVIEW_HERO_HEIGHT = 148;

/** Высота хиро на странице мероприятия в свёрнутом состоянии */
export const EVENT_PAGE_HERO_COLLAPSED_HEIGHT = 180;

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Диапазон (px), на который хиро сжимается от развёрнутого до свёрнутого */
export function calcHeroCollapseRange(expandedHeight: number): number {
  return Math.max(0, expandedHeight - EVENT_PAGE_HERO_COLLAPSED_HEIGHT);
}

/** Прогресс сворачивания 0…1 по накопленному смещению (px) */
export function calcHeroCollapseProgress(collapseOffset: number, expandedHeight: number): number {
  const range = calcHeroCollapseRange(expandedHeight);
  if (range <= 0) return 1;
  const linear = Math.min(1, Math.max(0, collapseOffset / range));
  return easeInOutQuad(linear);
}

export interface CoverNaturalSize {
  width: number;
  height: number;
}

export interface EventPageExpandedHeroOptions {
  hasCover?: boolean;
  coverNaturalSize?: CoverNaturalSize | null;
}

/** Высота обложки при вписывании по ширине контейнера с сохранением пропорций */
export function calcCoverFitHeight(containerWidth: number, naturalSize: CoverNaturalSize): number {
  if (naturalSize.width <= 0) return 0;
  return containerWidth * (naturalSize.height / naturalSize.width);
}

/** Высота хиро в развёрнутом состоянии — как у превью при той же ширине */
export function calcEventPageExpandedHeroHeight(
  width: number,
  options?: EventPageExpandedHeroOptions,
): number {
  if (!options?.hasCover) {
    return EVENT_PAGE_HERO_COLLAPSED_HEIGHT;
  }

  const maxExpanded =
    width <= EVENT_PREVIEW_HERO_WIDTH
      ? EVENT_PREVIEW_HERO_HEIGHT
      : (width / EVENT_PREVIEW_HERO_WIDTH) * EVENT_PREVIEW_HERO_HEIGHT;

  const coverNaturalSize = options.coverNaturalSize;
  if (coverNaturalSize && coverNaturalSize.width > 0) {
    const coverFitHeight = calcCoverFitHeight(width, coverNaturalSize);
    if (coverFitHeight < maxExpanded) {
      return coverFitHeight;
    }
  }

  return maxExpanded;
}

export function calcEventPageHeroHeight(expandedHeight: number, scrollCollapse: number): number {
  const collapsed = EVENT_PAGE_HERO_COLLAPSED_HEIGHT;
  if (expandedHeight <= collapsed) return expandedHeight;
  const t = Math.min(1, Math.max(0, scrollCollapse));
  return expandedHeight + (collapsed - expandedHeight) * t;
}
