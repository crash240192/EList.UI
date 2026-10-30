/** FLIP: разлёт миниатюр ↔ крупные карточки альбомов (мобилка). */

export const FLIP_MS = 420;
export const FLIP_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** Origin для альбомов, спрятанных в overflow-стопку. */
export const FLIP_STACK_ID = '__stack__';

export type FlipRect = { left: number; top: number; width: number; height: number };
export type FlipRects = Map<string, FlipRect>;

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function captureFlipRects(root: HTMLElement): FlipRects {
  const map: FlipRects = new Map();
  root.querySelectorAll<HTMLElement>('[data-album-flip-id]').forEach(el => {
    const id = el.dataset.albumFlipId;
    if (!id) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    map.set(id, { left: r.left, top: r.top, width: r.width, height: r.height });
  });
  return map;
}

/** First → Last: invert transform, затем play к identity. */
export function playFlipScatter(
  root: HTMLElement,
  first: FlipRects,
  albumOrder: readonly string[],
): Promise<void> {
  if (prefersReducedMotion() || first.size === 0) return Promise.resolve();

  const lasts = captureFlipRects(root);
  const stackFirst = first.get(FLIP_STACK_ID);
  const animations: Animation[] = [];

  albumOrder.forEach((id, index) => {
    const last = lasts.get(id);
    if (!last) return;
    const f = first.get(id) ?? stackFirst;
    if (!f) return;

    const el = root.querySelector<HTMLElement>(
      `[data-album-flip-id="${CSS.escape(id)}"]`,
    );
    if (!el) return;

    const dx = f.left - last.left;
    const dy = f.top - last.top;
    const sx = f.width / last.width;
    const sy = f.height / last.height;
    if (
      Math.abs(dx) < 0.5
      && Math.abs(dy) < 0.5
      && Math.abs(sx - 1) < 0.02
      && Math.abs(sy - 1) < 0.02
    ) {
      return;
    }

    const fromStack = !first.has(id) && Boolean(stackFirst);
    const delay = Math.min(index * 28, 160);

    el.style.transformOrigin = 'top left';
    el.style.zIndex = String(20 + index);

    const anim = el.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
          opacity: fromStack ? 0.35 : 1,
        },
        {
          transform: 'translate(0px, 0px) scale(1, 1)',
          opacity: 1,
        },
      ],
      {
        duration: FLIP_MS,
        delay,
        easing: FLIP_EASING,
        fill: 'both',
      },
    );
    animations.push(anim);
  });

  if (animations.length === 0) return Promise.resolve();

  return Promise.all(animations.map(a => a.finished.catch(() => undefined))).then(() => {
    albumOrder.forEach(id => {
      const el = root.querySelector<HTMLElement>(
        `[data-album-flip-id="${CSS.escape(id)}"]`,
      );
      if (!el) return;
      el.style.transformOrigin = '';
      el.style.zIndex = '';
    });
  });
}
