/** Пропорции обложки в модалке предпросмотра (EventModal) */
export const EVENT_PREVIEW_HERO_WIDTH = 400;
export const EVENT_PREVIEW_HERO_HEIGHT = 148;

/** Высота хиро на странице мероприятия в свёрнутом состоянии (десктоп / без фото) */
export const EVENT_PAGE_HERO_COLLAPSED_HEIGHT = 180;

/** Мобильный брейкпоинт — как --bp-mobile-max */
export const EVENT_PAGE_HERO_MOBILE_MAX_WIDTH = 639;

/** Высота фото обложки на мобилке (развёрнутая) */
export const EVENT_PAGE_HERO_MOBILE_HEIGHT = 250;

/** Свёрнутая высота на мобилке с фото — меньше expanded, иначе collapse = 0 */
export const EVENT_PAGE_HERO_MOBILE_COLLAPSED_HEIGHT = 160;

/**
 * @deprecated Не использовать как длину анимации: для sticky-слота
 * сжатие должно идти 1:1 с scrollTop на диапазоне (expanded − collapsed),
 * иначе между хиро и контентом растёт щель.
 */
export const EVENT_HERO_COLLAPSE_SCROLL_RANGE = 280;

/** На сколько px визуально сжимается хиро (слот в потоке остаётся expanded) */
export function calcHeroCollapseRange(expandedHeight: number, collapsedHeight: number): number {
  return Math.max(0, expandedHeight - collapsedHeight);
}

/**
 * Прогресс сворачивания 0…1 по scrollTop.
 * `collapseRangePx` = expanded − collapsed: высота хиро = expanded − scrollTop
 * (в пределах диапазона) → при position:sticky щель до belowHero = 0.
 */
export function scrollToHeroCollapse(scrollTop: number, collapseRangePx: number): number {
  if (collapseRangePx <= 0) return 1;
  return Math.min(1, Math.max(0, scrollTop / collapseRangePx));
}

export interface CoverNaturalSize {
  width: number;
  height: number;
}

export interface EventPageExpandedHeroOptions {
  hasCover?: boolean;
  coverNaturalSize?: CoverNaturalSize | null;
}

export function isEventHeroMobileWidth(width: number): boolean {
  return width > 0 && width <= EVENT_PAGE_HERO_MOBILE_MAX_WIDTH;
}

/** Свёрнутая высота: на мобилке с фото — 160px, иначе 180px */
export function calcEventPageCollapsedHeroHeight(width: number, hasCover: boolean): number {
  if (hasCover && isEventHeroMobileWidth(width)) {
    return EVENT_PAGE_HERO_MOBILE_COLLAPSED_HEIGHT;
  }
  return EVENT_PAGE_HERO_COLLAPSED_HEIGHT;
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

  if (isEventHeroMobileWidth(width)) {
    return EVENT_PAGE_HERO_MOBILE_HEIGHT;
  }

  const proportionalHeight =
    (width / EVENT_PREVIEW_HERO_WIDTH) * EVENT_PREVIEW_HERO_HEIGHT;

  const coverNaturalSize = options.coverNaturalSize;
  if (coverNaturalSize && coverNaturalSize.width > 0) {
    const coverFitHeight = calcCoverFitHeight(width, coverNaturalSize);
    if (coverFitHeight < proportionalHeight) {
      return coverFitHeight;
    }
  }

  return proportionalHeight;
}

export function calcEventPageHeroHeight(
  expandedHeight: number,
  scrollCollapse: number,
  collapsedHeight = EVENT_PAGE_HERO_COLLAPSED_HEIGHT,
): number {
  const collapsed = collapsedHeight;
  if (expandedHeight <= collapsed) return expandedHeight;
  const t = Math.min(1, Math.max(0, scrollCollapse));
  return expandedHeight + (collapsed - expandedHeight) * t;
}
