import { useCallback, useEffect, useRef, useState } from 'react';
import {
  calcHeroCollapseProgress,
  calcHeroCollapseRange,
} from '@/shared/lib/eventHeroSize';

interface UseEventPageHeroScrollOptions {
  pageRef: React.RefObject<HTMLDivElement | null>;
  hasCover: boolean;
  expandedHeroHeight: number;
  enabled: boolean;
  resetKey?: string | null;
}

export function useEventPageHeroScroll({
  pageRef,
  hasCover,
  expandedHeroHeight,
  enabled,
  resetKey,
}: UseEventPageHeroScrollOptions) {
  const collapseOffsetRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchCollapseStartRef = useRef(0);
  const expandedHeightRef = useRef(expandedHeroHeight);
  const hasCoverRef = useRef(hasCover);

  const [heroCollapse, setHeroCollapse] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  expandedHeightRef.current = expandedHeroHeight;
  hasCoverRef.current = hasCover;

  const getRange = useCallback(() => {
    if (!hasCoverRef.current) return 0;
    return calcHeroCollapseRange(expandedHeightRef.current);
  }, []);

  const applyCollapseOffset = useCallback((offset: number) => {
    const range = getRange();
    const clamped = range > 0 ? Math.min(range, Math.max(0, offset)) : 0;
    collapseOffsetRef.current = clamped;
    setHeroCollapse(calcHeroCollapseProgress(clamped, expandedHeightRef.current));
  }, [getRange]);

  const resetCollapse = useCallback(() => {
    collapseOffsetRef.current = 0;
    setHeroCollapse(hasCoverRef.current ? 0 : 1);
  }, []);

  useEffect(() => {
    applyCollapseOffset(collapseOffsetRef.current);
  }, [expandedHeroHeight, applyCollapseOffset]);

  useEffect(() => {
    if (!enabled) {
      resetCollapse();
      setShowScrollTop(false);
    }
  }, [enabled, resetCollapse]);

  useEffect(() => {
    resetCollapse();
    pageRef.current?.scrollTo({ top: 0 });
  }, [resetKey, resetCollapse, pageRef]);

  useEffect(() => {
    const el = pageRef.current;
    if (!el || !enabled) return;

    const onScroll = () => {
      const range = getRange();
      const offset = collapseOffsetRef.current;

      if (range > 0 && el.scrollTop > 0 && offset < range) {
        const remaining = range - offset;
        if (el.scrollTop <= remaining) {
          applyCollapseOffset(offset + el.scrollTop);
          el.scrollTop = 0;
        } else {
          applyCollapseOffset(range);
          el.scrollTop -= remaining;
        }
        return;
      }

      setShowScrollTop(el.scrollTop > 360);
    };

    const onWheel = (e: WheelEvent) => {
      const range = getRange();
      if (range <= 0) return;

      const offset = collapseOffsetRef.current;

      if (e.deltaY > 0) {
        if (offset < range) {
          e.preventDefault();
          applyCollapseOffset(offset + e.deltaY);
        }
        return;
      }

      if (e.deltaY < 0 && el.scrollTop <= 0 && offset > 0) {
        e.preventDefault();
        applyCollapseOffset(offset + e.deltaY);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      touchStartYRef.current = e.touches[0].clientY;
      touchCollapseStartRef.current = collapseOffsetRef.current;
    };

    const onTouchMove = (e: TouchEvent) => {
      const range = getRange();
      if (range <= 0 || e.touches.length !== 1) return;

      const dy = touchStartYRef.current - e.touches[0].clientY;
      const nextOffset = touchCollapseStartRef.current + dy;

      if (dy > 0 && collapseOffsetRef.current < range) {
        e.preventDefault();
        applyCollapseOffset(Math.min(range, Math.max(0, nextOffset)));
        return;
      }

      if (dy < 0 && el.scrollTop <= 0 && collapseOffsetRef.current > 0) {
        e.preventDefault();
        applyCollapseOffset(Math.max(0, nextOffset));
      }
    };

    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [pageRef, enabled, applyCollapseOffset, getRange]);

  const scrollToTop = useCallback(() => {
    resetCollapse();
    pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pageRef, resetCollapse]);

  return {
    heroCollapse,
    showScrollTop,
    scrollToTop,
  };
}
