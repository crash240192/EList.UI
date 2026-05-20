import { useState, useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import { findScrollParent } from './messageUtils';

export interface DiscussionSlotRect {
  left: number;
  width: number;
}

/**
 * Отслеживает left/width колонки обсуждения в координатах viewport,
 * чтобы fixed-форма совпадала с шириной блока при прокрутке страницы.
 */
export function useDiscussionSlotRect(
  boundsRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): DiscussionSlotRect {
  const [slot, setSlot] = useState<DiscussionSlotRect>({ left: 0, width: 0 });

  useLayoutEffect(() => {
    if (!enabled) return;
    const el = boundsRef.current;
    if (!el) return;

    const update = () => {
      const node = boundsRef.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      setSlot({ left: r.left, width: r.width });
    };

    update();
    const scrollRoot = findScrollParent(el);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    scrollRoot?.addEventListener('scroll', update, { passive: true });

    const ro = new ResizeObserver(update);
    ro.observe(el);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      scrollRoot?.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [boundsRef, enabled]);

  return slot;
}
