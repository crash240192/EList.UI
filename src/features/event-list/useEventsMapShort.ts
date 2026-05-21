// Компактные точки для карты: POST /api/events/search/short (до EVENTS_MAP_SHORT_PAGE_SIZE шт.)
// При смене области/фильтров старые точки остаются на карте до прихода нового ответа.

import { useState, useEffect, useRef, useCallback } from 'react';
import type { IEventsSearchParams, IEventSearchShortItem } from '@/entities/event';
import {
  EVENTS_MAP_SHORT_PAGE_SIZE,
  fetchEventsSearchShort,
  fetchEventsSearchShortMock,
} from '@/entities/event';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

interface UseEventsMapShortResult {
  items:     IEventSearchShortItem[];
  isLoading: boolean;
  error:     string | null;
  total:     number;
  refresh:   () => void;
}

export function useEventsMapShort(params: IEventsSearchParams, enabled: boolean): UseEventsMapShortResult {
  const [items, setItems]       = useState<IEventSearchShortItem[]>([]);
  const [isLoading, setLoading] = useState(enabled);
  const [error, setError]       = useState<string | null>(null);
  const [total, setTotal]       = useState(0);
  const loadGenerationRef       = useRef(0);
  const paramsKey               = JSON.stringify(params);

  const load = useCallback(async (generation: number) => {
    try {
      const fn = USE_MOCK ? fetchEventsSearchShortMock : fetchEventsSearchShort;
      const paged = await fn({ ...params, pageIndex: 0, pageSize: EVENTS_MAP_SHORT_PAGE_SIZE });
      if (generation !== loadGenerationRef.current) return;
      setItems(paged?.result ?? []);
      setTotal(paged?.total ?? 0);
      setError(null);
    } catch (err) {
      if (generation !== loadGenerationRef.current) return;
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      // Прежние точки на карте оставляем до успешной подгрузки
    }
  }, [paramsKey]);

  useEffect(() => {
    loadGenerationRef.current += 1;
    const generation = loadGenerationRef.current;

    if (!enabled) {
      setLoading(false);
      setItems([]);
      setTotal(0);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    void load(generation).finally(() => {
      if (generation === loadGenerationRef.current) setLoading(false);
    });
  }, [enabled, load]);

  const refresh = useCallback(() => {
    if (!enabled) return;
    loadGenerationRef.current += 1;
    const generation = loadGenerationRef.current;
    setLoading(true);
    setError(null);
    void load(generation).finally(() => {
      if (generation === loadGenerationRef.current) setLoading(false);
    });
  }, [enabled, load]);

  return { items, isLoading, error, total, refresh };
}
