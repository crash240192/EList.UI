// Загрузка компактных точек для карты (search/short, до 500 шт.)

import { useState, useEffect, useCallback } from 'react';
import type { IEventsSearchParams, IEventSearchShortItem } from '@/entities/event';
import { fetchEventsSearchShort, fetchEventsSearchShortMock } from '@/entities/event';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

interface UseEventsMapShortResult {
  items:    IEventSearchShortItem[];
  isLoading: boolean;
  error:     string | null;
  total:     number;
  refresh:   () => void;
}

export function useEventsMapShort(
  params: IEventsSearchParams,
  enabled: boolean,
): UseEventsMapShortResult {
  const [items, setItems]     = useState<IEventSearchShortItem[]>([]);
  const [isLoading, setLoading] = useState(enabled);
  const [error, setError]     = useState<string | null>(null);
  const [total, setTotal]     = useState(0);
  const paramsKey             = JSON.stringify(params);

  const load = useCallback(async () => {
    try {
      const fn = USE_MOCK ? fetchEventsSearchShortMock : fetchEventsSearchShort;
      const paged = await fn({ ...params, pageIndex: 0, pageSize: 500 });
      setItems(paged?.result ?? []);
      setTotal(paged?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      setItems([]);
      setTotal(0);
    }
  }, [paramsKey]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setItems([]);
      setTotal(0);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    load().finally(() => setLoading(false));
  }, [enabled, load]);

  const refresh = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    load().finally(() => setLoading(false));
  }, [enabled, load]);

  return { items, isLoading, error, total, refresh };
}
