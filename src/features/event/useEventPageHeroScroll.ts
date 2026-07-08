import { useCallback, useEffect, useRef, useState } from 'react';
import {
  calcHeroCollapseRange,
  EVENT_PAGE_HERO_COLLAPSED_HEIGHT,
} from '@/shared/lib/eventHeroSize';

interface UseEventPageHeroScrollOptions {
  pageRef: React.RefObject<HTMLDivElement | null>;
  heroRef: React.RefObject<HTMLDivElement | null>;
  pageBodyRef: React.RefObject<HTMLDivElement | null>;
  hasCover: boolean;
  expandedHeroHeight: number;
  enabled: boolean;
  resetKey?: string | null;
}

export function useEventPageHeroScroll({
  pageRef,
  heroRef,
  pageBodyRef,
  hasCover,
  expandedHeroHeight,
  enabled,
  resetKey,
}: UseEventPageHeroScrollOptions) {
  const collapseOffsetRef = useRef(0);
  const expandedRef = useRef(expandedHeroHeight);
  const hasCoverRef = useRef(hasCover);
  const [showScrollTop, setShowScrollTop] = useState(false);

  expandedRef.current = expandedHeroHeight;
  hasCoverRef.current = hasCover;

  const collapseRange = hasCover ? calcHeroCollapseRange(expandedHeroHeight) : 0;
  const heroVisibleHeight = collapseRange > 0
    ? expandedHeroHeight
    : EVENT_PAGE_HERO_COLLAPSED_HEIGHT;

  const getRange = useCallback(() => {
    if (!hasCoverRef.current) return 0;
    return calcHeroCollapseRange(expandedRef.current);
  }, []);

  const applyLayout = useCallback(() => {
    const hero = heroRef.current;
    const body = pageBodyRef.current;
    const range = getRange();
    const offset = collapseOffsetRef.current;
    const expanded = expandedRef.current;
    const collapsed = EVENT_PAGE_HERO_COLLAPSED_HEIGHT;

    if (!hero || !body) return;

    if (range <= 0) {
      hero.style.height = `${collapsed}px`;
      hero.style.setProperty('--event-hero-height', `${collapsed}px`);
      body.style.marginTop = `${collapsed}px`;
      body.style.transform = '';
      return;
    }

    const clampedOffset = Math.min(range, Math.max(0, offset));
    const heroHeight = Math.max(collapsed, expanded - clampedOffset);

    hero.style.height = `${heroHeight}px`;
    hero.style.setProperty('--event-hero-height', `${heroHeight}px`);

    if (clampedOffset < range) {
      body.style.marginTop = `${expanded}px`;
      body.style.transform = `translate3d(0, -${clampedOffset}px, 0)`;
    } else {
      body.style.marginTop = `${collapsed}px`;
      body.style.transform = '';
    }
  }, [getRange, heroRef, pageBodyRef]);

  const resetCollapse = useCallback(() => {
    collapseOffsetRef.current = 0;
    applyLayout();
  }, [applyLayout]);

  useEffect(() => {
    if (!enabled) {
      resetCollapse();
      setShowScrollTop(false);
    }
  }, [enabled, resetCollapse]);

  useEffect(() => {
    resetCollapse();
    pageRef.current?.scrollTo({ top: 0 });
    setShowScrollTop(false);
  }, [resetKey, pageRef, resetCollapse]);

  useEffect(() => {
    applyLayout();
  }, [expandedHeroHeight, hasCover, applyLayout]);

  useEffect(() => {
    const el = pageRef.current;
    if (!el || !enabled) return;

    const consumeWheelDelta = (deltaY: number) => {
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
        const remaining = range - offset;
        const absorb = Math.min(el.scrollTop, remaining);
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
      if (consumeWheelDelta(e.deltaY)) {
        e.preventDefault();
      }
    };

    let touchStartY = 0;
    let touchCollapseStart = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      touchStartY = e.touches[0].clientY;
      touchCollapseStart = collapseOffsetRef.current;
    };

    const onTouchMove = (e: TouchEvent) => {
      const range = getRange();
      if (range <= 0 || e.touches.length !== 1) return;

      const dy = touchStartY - e.touches[0].clientY;
      if (dy === 0) return;

      const nextOffset = touchCollapseStart + dy;
      const offset = collapseOffsetRef.current;

      if (dy > 0 && offset < range) {
        e.preventDefault();
        if (nextOffset <= range) {
          collapseOffsetRef.current = nextOffset;
          applyLayout();
        } else {
          collapseOffsetRef.current = range;
          applyLayout();
        }
        return;
      }

      if (dy < 0 && el.scrollTop <= 0 && offset > 0) {
        e.preventDefault();
        collapseOffsetRef.current = Math.max(0, nextOffset);
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
    resetCollapse();
    pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pageRef, resetCollapse]);

  return {
    heroVisibleHeight,
    showScrollTop,
    scrollToTop,
  };
}
