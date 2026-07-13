/** Standard responsive breakpoints — mobile ≤639, tablet 640–1023, desktop ≥1024 */

export const BP = {
  mobileMax: 639,
  tabletMin: 640,
  tabletMax: 1023,
  desktopMin: 1024,
  wideMin: 1280,
} as const;

export const media = {
  mobile: `(max-width: ${BP.mobileMax}px)`,
  tablet: `(min-width: ${BP.tabletMin}px) and (max-width: ${BP.tabletMax}px)`,
  desktop: `(min-width: ${BP.desktopMin}px)`,
  tabletUp: `(min-width: ${BP.tabletMin}px)`,
  /* Широкий десктоп — боковое меню закреплено (docked), а не оверлей */
  wide: `(min-width: ${BP.wideMin}px)`,
} as const;

export function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(media.mobile).matches;
}

export function isTabletViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(media.tablet).matches;
}

export function isWideViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(media.wide).matches;
}
