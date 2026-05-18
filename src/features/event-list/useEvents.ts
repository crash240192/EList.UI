// features/event-list/useEvents.ts
// Custom hook для загрузки мероприятий с пагинацией

import { useState, useEffect, useRef, useCallback } from 'react';
import type { IEvent, IEventsSearchParams } from '@/entities/event';
import { fetchEvents, fetchEventsMock } from '@/entities/event';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const PAGE_SIZE = 20;

function mergeUniqueEvents(prev: IEvent[], next: IEvent[]): IEvent[] {
  const seen = new Set(prev.map((e) => e.id));
  const unique = next.filter((e) => !seen.has(e.id));
  return unique.length === 0 ? prev : [...prev, ...unique];
}

interface UseEventsResult {
  events: IEvent[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
  refresh: () => void;
  total: number;
}

export function useEvents(params: IEventsSearchParams, enabled = true): UseEventsResult {
  const [events, setEvents] = useState<IEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const pageRef = useRef(0);
  /** Увеличивается при смене фильтров / отключении — отбрасываем ответы устаревших запросов */
  const loadGenerationRef = useRef(0);

  const paramsKey = JSON.stringify(params);

  const load = useCallback(
    async (pageIndex: number, append: boolean, generation: number) => {
      try {
        const fn = USE_MOCK ? fetchEventsMock : fetchEvents;
        const result = await fn({ ...params, pageIndex, pageSize: PAGE_SIZE });

        if (generation !== loadGenerationRef.current) return;

        setTotal(result.total);
        setEvents((prev) =>
          append ? mergeUniqueEvents(prev, result.result) : result.result,
        );
        setHasMore(
          result.result.length === PAGE_SIZE && (pageIndex + 1) * PAGE_SIZE < result.total,
        );
        setError(null);
      } catch (err) {
        if (generation !== loadGenerationRef.current) return;
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paramsKey],
  );

  useEffect(() => {
    loadGenerationRef.current += 1;
    const generation = loadGenerationRef.current;

    if (!enabled) {
      setIsLoading(false);
      setIsLoadingMore(false);
      setEvents([]);
      setHasMore(false);
      setTotal(0);
      setError(null);
      return;
    }

    pageRef.current = 0;
    setEvents([]);
    setIsLoading(true);
    setIsLoadingMore(false);
    setError(null);
    setHasMore(false);

    void load(0, false, generation).finally(() => {
      if (generation === loadGenerationRef.current) setIsLoading(false);
    });
  }, [load, enabled]);

  const loadMore = useCallback(() => {
    if (!enabled || isLoadingMore || !hasMore || isLoading) return;
    const generation = loadGenerationRef.current;
    const nextPage = pageRef.current + 1;
    pageRef.current = nextPage;
    setIsLoadingMore(true);
    void load(nextPage, true, generation).finally(() => {
      if (generation === loadGenerationRef.current) setIsLoadingMore(false);
    });
  }, [enabled, isLoadingMore, hasMore, isLoading, load]);

  const refresh = useCallback(() => {
    if (!enabled) return;
    loadGenerationRef.current += 1;
    const generation = loadGenerationRef.current;
    pageRef.current = 0;
    setEvents([]);
    setIsLoading(true);
    setError(null);
    void load(0, false, generation).finally(() => {
      if (generation === loadGenerationRef.current) setIsLoading(false);
    });
  }, [enabled, load]);

  return { events, isLoading, isLoadingMore, hasMore, error, loadMore, refresh, total };
}
