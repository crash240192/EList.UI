// features/event-list/useEvents.ts
// Custom hook для загрузки мероприятий с пагинацией

import { useState, useEffect, useRef, useCallback } from 'react';
import type { IEvent, IEventsSearchParams } from '@/entities/event';
import { fetchEvents, fetchEventsMock } from '@/entities/event';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const PAGE_SIZE = 20;

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

  // Сброс при смене фильтров
  const paramsKey = JSON.stringify(params);

  const load = useCallback(
    async (pageIndex: number, append: boolean) => {
      try {
        const fn = USE_MOCK ? fetchEventsMock : fetchEvents;
        const result = await fn({ ...params, pageIndex, pageSize: PAGE_SIZE });

        setTotal(result.total);
        setEvents((prev) => (append ? [...prev, ...result.result] : result.result));
        setHasMore(result.result.length === PAGE_SIZE && (pageIndex + 1) * PAGE_SIZE < result.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paramsKey]
  );

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setEvents([]);
      setHasMore(false);
      setTotal(0);
      return;
    }
    pageRef.current = 0;
    setIsLoading(true);
    setError(null);
    load(0, false).finally(() => setIsLoading(false));
  }, [load, enabled]);

  const loadMore = useCallback(() => {
    if (!enabled || isLoadingMore || !hasMore) return;
    const nextPage = pageRef.current + 1;
    pageRef.current = nextPage;
    setIsLoadingMore(true);
    load(nextPage, true).finally(() => setIsLoadingMore(false));
  }, [enabled, isLoadingMore, hasMore, load]);

  const refresh = useCallback(() => {
    if (!enabled) return;
    pageRef.current = 0;
    setIsLoading(true);
    setError(null);
    load(0, false).finally(() => setIsLoading(false));
  }, [enabled, load]);

  return { events, isLoading, isLoadingMore, hasMore, error, loadMore, refresh, total };
}
