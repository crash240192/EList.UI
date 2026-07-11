import { useCallback, useEffect, useRef, useState } from 'react';
import {
  calcHeroCollapseRange,
  EVENT_PAGE_HERO_COLLAPSED_HEIGHT,
} from '@/shared/lib/eventHeroSize';

interface UseEventHeroOverlayScrollOptions {
  pageRef: React.RefObject<HTMLDivElement | null>;
  heroRef: React.RefObject<HTMLDivElement | null>;
  pageBodyRef: React.RefObject<HTMLDivElement | null>;
  expandedHeroHeight: number;
  enabled: boolean;
  resetKey?: string | null;
}

export function useEventHeroOverlayScroll({
  pageRef,
  heroRef,
  pageBodyRef,
  expandedHeroHeight,
  enabled,
  resetKey,
}: UseEventHeroOverlayScrollOptions) {
  const collapseOffsetRef = useRef(0);
  const expandedRef = useRef(expandedHeroHeight);
  const [showScrollTop, setShowScrollTop] = useState(false);

  expandedRef.current = expandedHeroHeight;

  const getRange = useCallback(
    () => calcHeroCollapseRange(expandedRef.current),
    [],
  );

  const applyLayout = useCallback(() => {
    const hero = heroRef.current;
    const body = pageBodyRef.current;
    if (!hero || !body) return;

    const expanded = expandedRef.current;
    const collapsed = EVENT_PAGE_HERO_COLLAPSED_HEIGHT;
    const range = getRange();
    const offset = Math.min(range, Math.max(0, collapseOffsetRef.current));

    if (range <= 0) {
      hero.style.height = `${collapsed}px`;
      hero.style.setProperty('--event-hero-height', `${collapsed}px`);
      body.style.marginTop = `${collapsed}px`;
      body.style.transform = '';
      return;
    }

    const heroHeight = Math.max(collapsed, expanded - offset);
    hero.style.height = `${heroHeight}px`;
    hero.style.setProperty('--event-hero-height', `${heroHeight}px`);

    if (offset < range) {
      body.style.marginTop = `${expanded}px`;
      body.style.transform = `translate3d(0, ${-offset}px, 0)`;
    } else {
      body.style.marginTop = `${collapsed}px`;
      body.style.transform = '';
    }
  }, [getRange, heroRef, pageBodyRef]);

  const resetOverlay = useCallback(() => {
    collapseOffsetRef.current = 0;
    applyLayout();
  }, [applyLayout]);

  useEffect(() => {
    if (!enabled) {
      collapseOffsetRef.current = 0;
      setShowScrollTop(false);
      applyLayout();
    }
  }, [enabled, applyLayout]);

  useEffect(() => {
    collapseOffsetRef.current = 0;
    pageRef.current?.scrollTo({ top: 0 });
    setShowScrollTop(false);
    applyLayout();
  }, [resetKey, pageRef, applyLayout]);

  useEffect(() => {
    applyLayout();
  }, [expandedHeroHeight, applyLayout]);

  useEffect(() => {
    const el = pageRef.current;
    if (!el || !enabled) return;

    const consumeDelta = (deltaY: number): boolean => {
      const range = getRange();
      if (range <= 0) return false;

      const offset = collapseOffsetRef.current;

      if (deltaY > 0) {
        if (offset >= range) return false;

        const next = offset + deltaY;
        if (next <= range) {
          collapseOffsetRef.current = next;
          applyLayout();
          return true;
        }

        collapseOffsetRef.current = range;
        applyLayout();
        el.scrollTop += next - range;
        return true;
      }

      if (deltaY < 0) {
        if (el.scrollTop > 0) return false;

        if (offset > 0) {
          collapseOffsetRef.current = Math.max(0, offset + deltaY);
          applyLayout();
          return true;
        }
      }

      return false;
    };

    const onScroll = () => {
      const range = getRange();
      if (range > 0 && collapseOffsetRef.current < range && el.scrollTop > 0) {
        const offset = collapseOffsetRef.current;
        const absorb = Math.min(el.scrollTop, range - offset);
        collapseOffsetRef.current = offset + absorb;
        el.scrollTop -= absorb;
        applyLayout();
      }

      setShowScrollTop(prev => {
        const next = el.scrollTop > 360;
        return prev === next ? prev : next;
      });
    };

    const onWheel = (e: WheelEvent) => {
      if (consumeDelta(e.deltaY)) e.preventDefault();
    };

    let touchStartY = 0;
    let touchOffsetStart = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      touchStartY = e.touches[0].clientY;
      touchOffsetStart = collapseOffsetRef.current;
    };

    const onTouchMove = (e: TouchEvent) => {
      const range = getRange();
      if (range <= 0 || e.touches.length !== 1) return;

      const dy = touchStartY - e.touches[0].clientY;
      const next = touchOffsetStart + dy;

      if (dy > 0 && collapseOffsetRef.current < range) {
        e.preventDefault();
        collapseOffsetRef.current = Math.min(range, Math.max(0, next));
        applyLayout();
        return;
      }

      if (dy < 0 && el.scrollTop <= 0 && collapseOffsetRef.current > 0) {
        e.preventDefault();
        collapseOffsetRef.current = Math.max(0, next);
        applyLayout();
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
  }, [pageRef, enabled, applyLayout, getRange]);

  const scrollToTop = useCallback(() => {
    resetOverlay();
    pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pageRef, resetOverlay]);

  const collapseRange = getRange();
  const initialHeroHeight = collapseRange > 0
    ? expandedHeroHeight
    : EVENT_PAGE_HERO_COLLAPSED_HEIGHT;

  return {
    initialHeroHeight,
    initialBodyMarginTop: initialHeroHeight,
    showScrollTop,
    scrollToTop,
  };
}
