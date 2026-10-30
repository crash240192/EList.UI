/**
 * Якорение скролла на странице мероприятия.
 *
 * Важно: скроллит НЕ document, а контейнер `.page` (overflow-y: auto внутри
 * AppLayout с overflow:hidden). Правка document.scrollTop — no-op.
 *
 * Для разворота блоков (альбомы, описание) надёжнее **заморозить scrollTop**:
 * контент растёт вниз в потоке, верхняя кромка секции остаётся на месте.
 * getBoundingClientRect-якорь ломается, если найден неверный scroller или если
 * scroll-handler хиро меняет высоту hero в ответ на программный scrollTop.
 */

const PAGE_SCROLL_ATTR = 'data-page-scroll';
const SCROLL_LOCK_ATTR = 'data-scroll-lock';

export function findPageScroller(from?: Element | null): HTMLElement | null {
  const scope = from instanceof Element ? from : document;
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

/** Пометить контейнер как page-scroller (вызывать на EventPage .page). */
export function markPageScroller(el: HTMLElement | null): void {
  if (!el) return;
  el.setAttribute(PAGE_SCROLL_ATTR, 'true');
}

export function isScrollLocked(scroller: HTMLElement | null): boolean {
  return scroller?.getAttribute(SCROLL_LOCK_ATTR) === '1';
}

export function lockPageScroll(scroller: HTMLElement | null): void {
  if (!scroller) return;
  scroller.setAttribute(SCROLL_LOCK_ATTR, '1');
}

export function unlockPageScroll(scroller: HTMLElement | null): void {
  if (!scroller) return;
  scroller.removeAttribute(SCROLL_LOCK_ATTR);
}

export type ScrollTopSnapshot = {
  scroller: HTMLElement;
  scrollTop: number;
};

/** Запомнить scrollTop page-scroller (предпочтительно для expand/collapse). */
export function captureScrollTop(from: Element | null): ScrollTopSnapshot | null {
  const scroller = findPageScroller(from);
  if (!scroller) return null;
  return { scroller, scrollTop: scroller.scrollTop };
}

/**
 * Восстановить scrollTop и кратко залочить scroller, чтобы scroll-handler
 * хиро не менял высоту hero в том же кадре.
 */
export function restoreScrollTop(snapshot: ScrollTopSnapshot | null): void {
  if (!snapshot) return;
  const { scroller, scrollTop } = snapshot;
  if (Math.abs(scroller.scrollTop - scrollTop) < 0.5) return;
  lockPageScroll(scroller);
  scroller.scrollTop = scrollTop;
  // Снять lock после paint — hero синхронизируется уже с финальным scrollTop.
  requestAnimationFrame(() => {
    unlockPageScroll(scroller);
    scroller.dispatchEvent(new Event('scroll'));
  });
}

export type ScrollAnchorSnapshot = {
  scroller: HTMLElement;
  top: number;
};

/** Снимок якоря по getBoundingClientRect (для смены вида обсуждений и т.п.). */
export function captureScrollAnchor(anchor: HTMLElement | null): ScrollAnchorSnapshot | null {
  if (!anchor) return null;
  const scroller = findPageScroller(anchor);
  if (!scroller) return null;
  return { scroller, top: anchor.getBoundingClientRect().top };
}

export function restoreScrollAnchor(
  snapshot: ScrollAnchorSnapshot | null,
  anchor: HTMLElement | null,
): void {
  if (!snapshot || !anchor) return;
  const after = anchor.getBoundingClientRect().top;
  const delta = after - snapshot.top;
  if (Math.abs(delta) < 0.5) return;
  lockPageScroll(snapshot.scroller);
  snapshot.scroller.scrollTop += delta;
  requestAnimationFrame(() => {
    unlockPageScroll(snapshot.scroller);
    snapshot.scroller.dispatchEvent(new Event('scroll'));
  });
}
