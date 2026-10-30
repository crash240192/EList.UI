/**
 * Якорение скролла при резком изменении высоты контента (свёртка секций, смена режима).
 *
 * Правило: якорь = верхний край блока, который меняет высоту (секция альбомов,
 * описание, панель обсуждений). Тогда блок «растёт вниз», а не всплывает вверх.
 * Не якорить элементы НИЖЕ меняющегося блока — иначе контент уезжает вверх.
 */

export function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')
      && node.scrollHeight > node.clientHeight + 1
    ) {
      return node;
    }
    node = node.parentElement;
  }
  const root = document.scrollingElement;
  return root instanceof HTMLElement ? root : document.documentElement;
}

export type ScrollAnchorSnapshot = {
  scroller: HTMLElement;
  /** getBoundingClientRect().top якоря до изменения layout */
  top: number;
};

/** Снять снимок якоря относительно ближайшего скролл-контейнера. */
export function captureScrollAnchor(anchor: HTMLElement | null): ScrollAnchorSnapshot | null {
  if (!anchor) return null;
  const scroller = getScrollParent(anchor);
  if (!scroller) return null;
  return { scroller, top: anchor.getBoundingClientRect().top };
}

/**
 * Восстановить визуальную позицию якоря после layout.
 * Вызывать в useLayoutEffect сразу после commit.
 */
export function restoreScrollAnchor(snapshot: ScrollAnchorSnapshot | null, anchor: HTMLElement | null): void {
  if (!snapshot || !anchor) return;
  const after = anchor.getBoundingClientRect().top;
  const delta = after - snapshot.top;
  if (Math.abs(delta) < 0.5) return;
  snapshot.scroller.scrollTop += delta;
}
