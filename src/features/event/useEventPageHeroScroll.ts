import { useCallback, useEffect, useRef, useState } from 'react';
import {
  calcHeroCollapseRange,
  EVENT_PAGE_HERO_COLLAPSED_HEIGHT,
} from '@/shared/lib/eventHeroSize';

interface UseEventPageHeroScrollOptions {
  pageRef: React.RefObject<HTMLDivElement | null>;
  heroRef: React.RefObject<HTMLDivElement | null>;
  hasCover: boolean;
  expandedHeroHeight: number;
  enabled: boolean;
  resetKey?: string | null;
}

function calcHeroVisibleHeight(
  scrollTop: number,
  hasCover: boolean,
  expandedHeroHeight: number,
): number {
  const collapseRange = hasCover ? calcHeroCollapseRange(expandedHeroHeight) : 0;
  if (collapseRange <= 0) return EVENT_PAGE_HERO_COLLAPSED_HEIGHT;
  return Math.max(EVENT_PAGE_HERO_COLLAPSED_HEIGHT, expandedHeroHeight - scrollTop);
}

export function useEventPageHeroScroll({
  pageRef,
  heroRef,
  hasCover,
  expandedHeroHeight,
  enabled,
  resetKey,
}: UseEventPageHeroScrollOptions) {
  const scrollTopRef = useRef(0);
  const expandedRef = useRef(expandedHeroHeight);
  const hasCoverRef = useRef(hasCover);
  const [showScrollTop, setShowScrollTop] = useState(false);

  expandedRef.current = expandedHeroHeight;
  hasCoverRef.current = hasCover;

  const collapseRange = hasCover ? calcHeroCollapseRange(expandedHeroHeight) : 0;
  const heroBlockHeight = collapseRange > 0
    ? expandedHeroHeight
    : EVENT_PAGE_HERO_COLLAPSED_HEIGHT;
  const heroVisibleHeight = calcHeroVisibleHeight(0, hasCover, expandedHeroHeight);

  const applyHeroHeight = useCallback((scrollTop: number) => {
    const hero = heroRef.current;
    if (!hero) return;
    const visible = calcHeroVisibleHeight(
      scrollTop,
      hasCoverRef.current,
      expandedRef.current,
    );
    hero.style.height = `${visible}px`;
    hero.style.setProperty('--event-hero-height', `${visible}px`);
  }, [heroRef]);

  useEffect(() => {
    if (!enabled) {
      scrollTopRef.current = 0;
      setShowScrollTop(false);
      applyHeroHeight(0);
    }
  }, [enabled, applyHeroHeight]);

  useEffect(() => {
    scrollTopRef.current = 0;
    pageRef.current?.scrollTo({ top: 0 });
    setShowScrollTop(false);
    applyHeroHeight(0);
  }, [resetKey, pageRef, applyHeroHeight]);

  useEffect(() => {
    applyHeroHeight(scrollTopRef.current);
  }, [expandedHeroHeight, hasCover, applyHeroHeight]);

  useEffect(() => {
    const el = pageRef.current;
    if (!el || !enabled) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        scrollTopRef.current = el.scrollTop;
        applyHeroHeight(el.scrollTop);
        setShowScrollTop(prev => {
          const next = el.scrollTop > 360;
          return prev === next ? prev : next;
        });
      });
    };

    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', onScroll);
    };
  }, [pageRef, enabled, applyHeroHeight]);

  const scrollToTop = useCallback(() => {
    pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pageRef]);

  return {
    heroBlockHeight,
    heroVisibleHeight,
    showScrollTop,
    scrollToTop,
  };
}
