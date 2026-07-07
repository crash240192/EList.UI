/** Пропорции обложки в модалке предпросмотра (EventModal) */
export const EVENT_PREVIEW_HERO_WIDTH = 400;
export const EVENT_PREVIEW_HERO_HEIGHT = 148;

/** Высота хиро на странице мероприятия в свёрнутом состоянии */
export const EVENT_PAGE_HERO_COLLAPSED_HEIGHT = 180;

/** Диапазон прокрутки (px), за который хиро сворачивается полностью */
export const EVENT_HERO_COLLAPSE_SCROLL_RANGE = 280;

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Прогресс сворачивания 0…1 по позиции прокрутки */
export function scrollToHeroCollapse(scrollTop: number): number {
  const linear = Math.min(1, Math.max(0, scrollTop / EVENT_HERO_COLLAPSE_SCROLL_RANGE));
  return easeInOutQuad(linear);
}

/** Высота хиро в развёрнутом состоянии — как у превью при той же ширине */
export function calcEventPageExpandedHeroHeight(width: number): number {
  if (width <= EVENT_PREVIEW_HERO_WIDTH) return EVENT_PREVIEW_HERO_HEIGHT;
  return (width / EVENT_PREVIEW_HERO_WIDTH) * EVENT_PREVIEW_HERO_HEIGHT;
}

export function calcEventPageHeroHeight(expandedHeight: number, scrollCollapse: number): number {
  const collapsed = EVENT_PAGE_HERO_COLLAPSED_HEIGHT;
  if (expandedHeight <= collapsed) return expandedHeight;
  const t = Math.min(1, Math.max(0, scrollCollapse));
  return expandedHeight + (collapsed - expandedHeight) * t;
}
