// shared/hooks/useInView.ts — IntersectionObserver: элемент рядом с viewport?

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseInViewOptions {
  /** Запас до появления во viewport (по умолчанию подгружаем заранее). */
  rootMargin?: string;
  threshold?: number;
  /** После первого появления больше не отключать (для картинок). */
  once?: boolean;
  enabled?: boolean;
}

/**
 * Возвращает ref-callback и флаг «в зоне видимости».
 * root — ближайший scroll-parent (как у infinite scroll).
 */
export function useInView(options: UseInViewOptions = {}) {
  const {
    rootMargin = '240px 0px',
    threshold = 0.01,
    once = true,
    enabled = true,
  } = options;

  const [inView, setInView] = useState(false);
  const [node, setNode] = useState<Element | null>(null);
  const frozenRef = useRef(false);

  const ref = useCallback((el: Element | null) => {
    setNode(el);
  }, []);

  useEffect(() => {
    if (!enabled || !node || frozenRef.current) return;

    let root: Element | null = null;
    let cur = node.parentElement;
    while (cur) {
      const style = getComputedStyle(cur);
      if (/(auto|scroll)/.test(style.overflowY) || /(auto|scroll)/.test(style.overflowX)) {
        root = cur;
        break;
      }
      cur = cur.parentElement;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = Boolean(entries[0]?.isIntersecting);
        if (!visible) {
          if (!once) setInView(false);
          return;
        }
        setInView(true);
        if (once) {
          frozenRef.current = true;
          observer.disconnect();
        }
      },
      { root, rootMargin, threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [node, rootMargin, threshold, once, enabled]);

  return { ref, inView: enabled ? inView : true } as const;
}
