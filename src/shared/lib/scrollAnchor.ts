/**
 * Скролл и якорение на странице мероприятия
 * =========================================
 *
 * Иерархия (единственный scrollport — `.page`):
 *
 *   AppLayout.root (100svh, overflow:hidden)
 *     main (overflow:hidden)
 *       EventPage .page [data-page-scroll]  ← scrollTop / scroll events
 *         .card
 *           .heroSlot         FIXED height = expanded (в потоке)
 *             .hero           sticky + visual height = f(scrollTop)
 *           .belowHero        z-index поверх «пустого» хвоста слота
 *             actionRow / mainGrid / discussions
 *
 * Хиро: слот держит layout; сжатие только визуальное → нет петли
 * scrollTop → height → scrollTop (compensateScrollerForHeightDelta для hero не нужен).
 *
 * Важно: между .page (scrollport) и .hero не должно быть overflow:hidden/auto
 * (типичный виновник — pageShell .card). Иначе sticky не цепляется к .page,
 * хиро уезжает вверх, а в слоте остаётся пустой зазор до .belowHero.
 *
 * Цепочка при expand/collapse блока (альбомы / описание):
 *   1) capture: top секции (getBoundingClientRect) + scroller
 *   2) React commit (высота секции изменилась)
 *   3) restore: scrollTop += (topAfter − topBefore) → верх секции на месте
 *   4) второй проход в rAF
 */

const PAGE_SCROLL_ATTR = 'data-page-scroll';

export function findPageScroller(from?: Element | null): HTMLElement | null {
  const marked =
    (from instanceof Element ? from.closest(`[${PAGE_SCROLL_ATTR}]`) : null)
    ?? document.querySelector(`[${PAGE_SCROLL_ATTR}]`);
  if (marked instanceof HTMLElement) return marked;

  let node: Element | null = from instanceof Element ? from.parentElement : null;
  while (node && node !== document.documentElement) {
    if (node instanceof HTMLElement) {
      const overflowY = window.getComputedStyle(node).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
        return node;
      }
    }
    node = node.parentElement;
  }
  return null;
}

/** Пометить контейнер как page-scroller (EventPage .page). */
export function markPageScroller(el: HTMLElement | null): void {
  if (!el) return;
  el.setAttribute(PAGE_SCROLL_ATTR, 'true');
}

export type ScrollAnchorSnapshot = {
  scroller: HTMLElement;
  /** getBoundingClientRect().top якоря до изменения layout */
  top: number;
};

/** Снимок верхнего края якоря (секция, которая меняет высоту). */
export function captureScrollAnchor(anchor: HTMLElement | null): ScrollAnchorSnapshot | null {
  if (!anchor) return null;
  const scroller = findPageScroller(anchor);
  if (!scroller) return null;
  return { scroller, top: anchor.getBoundingClientRect().top };
}

function applyAnchorDelta(snapshot: ScrollAnchorSnapshot, anchor: HTMLElement): number {
  const after = anchor.getBoundingClientRect().top;
  const delta = after - snapshot.top;
  if (Math.abs(delta) < 0.5) return 0;
  snapshot.scroller.scrollTop += delta;
  return delta;
}

/**
 * Восстановить визуальную позицию якоря после layout.
 * Два прохода: сразу + rAF (после возможной реакции hero / overflow-anchor).
 */
export function restoreScrollAnchor(
  snapshot: ScrollAnchorSnapshot | null,
  anchor: HTMLElement | null,
): void {
  if (!snapshot || !anchor) return;
  applyAnchorDelta(snapshot, anchor);
  requestAnimationFrame(() => {
    if (!anchor.isConnected) return;
    applyAnchorDelta(snapshot, anchor);
  });
}

/**
 * Компенсация изменения высоты hero: чтобы контент ниже не прыгал
 * при scroll-linked collapse. Вызывать из useLayoutEffect([heroHeight]).
 */
export function compensateScrollerForHeightDelta(
  scroller: HTMLElement | null,
  prevHeight: number | null,
  nextHeight: number,
): number {
  if (!scroller || prevHeight == null) return nextHeight;
  const delta = nextHeight - prevHeight;
  if (Math.abs(delta) < 0.5) return nextHeight;
  // У самого верха рост hero не компенсируем — иначе уезжаем вниз.
  if (scroller.scrollTop <= 0 && delta > 0) return nextHeight;
  scroller.scrollTop += delta;
  return nextHeight;
}
