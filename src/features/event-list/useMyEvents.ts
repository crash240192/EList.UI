// features/event-list/useMyEvents.ts
//
// Логика:
// - Три вкладки ('all', 'mine', 'others') — у каждой свой кеш и свой API-запрос
// - При первом открытии вкладки → делаем запрос к API
// - При повторном переключении → сразу показываем кешированные данные
// - При прокрутке до конца → загружаем следующую страницу
// - Пустой список в ответе → останавливаем пагинацию для этой вкладки
// - Сброс всего кеша при смене доп. фильтров (название, тип, дата, цена)

import { useState, useEffect, useRef, useCallback } from 'react';
import type { IEvent, IEventsSearchParams } from '@/entities/event';
import { fetchEvents } from '@/entities/event';

export type OwnerFilter = 'all' | 'mine' | 'others';

const PAGE_SIZE = 20;

// Состояние одной вкладки
interface TabState {
  events:   IEvent[];
  page:     number;
  hasMore:  boolean;
  isLoaded: boolean; // был ли хотя бы один успешный запрос
}

function emptyTab(): TabState {
  return { events: [], page: 0, hasMore: true, isLoaded: false };
}

// Параметры фильтра по вкладке
function ownerParams(
  filter: OwnerFilter,
  accountId: string
): Pick<IEventsSearchParams, 'organizatorId' | 'participantId'> {
  switch (filter) {
    case 'mine':   return { organizatorId: accountId };
    case 'others': return { participantId: accountId };
    case 'all':
    default:       return { organizatorId: accountId, participantId: accountId };
  }
}

interface Options {
  accountId:    string | null;
  ownerFilter:  OwnerFilter;
  tab:          'active' | 'archive';
  extraParams:  Partial<IEventsSearchParams>;
}

interface Result {
  events:        IEvent[];
  isLoading:     boolean;
  isLoadingMore: boolean;
  hasMore:       boolean;
  error:         string | null;
  loadMore:      () => void;
}

export function useMyEvents({ accountId, ownerFilter, tab, extraParams }: Options): Result {
  // Кеш: три вкладки × данные
  const cache = useRef<Record<OwnerFilter, TabState>>({
    all:    emptyTab(),
    mine:   emptyTab(),
    others: emptyTab(),
  });

  // Отслеживаем идущую загрузку для текущей вкладки
  const loadingRef = useRef(false);

  // Ключ для сброса кеша при смене фильтров (не включает ownerFilter)
  const filterKey = JSON.stringify({
    accountId, tab,
    name:       extraParams.name,
    categories: extraParams.categories,
    types:      extraParams.types,
    startTime:  extraParams.startTime,
    endTime:    extraParams.endTime,
    price:      extraParams.price,
  });
  const prevFilterKey = useRef(filterKey);

  // Если фильтры изменились — сбрасываем весь кеш
  if (prevFilterKey.current !== filterKey) {
    prevFilterKey.current = filterKey;
    cache.current = { all: emptyTab(), mine: emptyTab(), others: emptyTab() };
  }

  // UI-state: только то, что нужно для рендера
  const [isLoading,     setIsLoading]     = useState(!cache.current[ownerFilter].isLoaded);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore,       setHasMore]       = useState(cache.current[ownerFilter].hasMore);
  const [error,         setError]         = useState<string | null>(null);
  const [tick,          setTick]          = useState(0); // форсирует ре-рендер

  // Синхронизируем UI при смене вкладки
  useEffect(() => {
    const s = cache.current[ownerFilter];
    setHasMore(s.hasMore);
    setIsLoading(!s.isLoaded);
    setError(null);
    loadingRef.current = false;
  }, [ownerFilter, filterKey]);

  // Функция загрузки страницы
  const loadPage = useCallback(async (page: number) => {
    if (!accountId || loadingRef.current) return;
    loadingRef.current = true;

    const isFirst = page === 0;
    if (isFirst) setIsLoading(true);
    else         setIsLoadingMore(true);
    setError(null);

    try {
      const result = await fetchEvents({
        ...ownerParams(ownerFilter, accountId),
        // Активные: startTime = сейчас (события, которые начнутся или уже идут)
        // Прошедшие: endTime = сейчас (события, которые уже закончились)
        ...(tab === 'active'  ? { startTime: new Date().toISOString() } : {}),
        ...(tab === 'archive' ? { endTime:   new Date().toISOString() } : {}),
        name:       extraParams.name       || undefined,
        categories: extraParams.categories || undefined,
        types:      extraParams.types      || undefined,
        price:      extraParams.price      || undefined,
        pageIndex:  page,
        pageSize:   PAGE_SIZE,
      });

      const incoming = result.result ?? [];
      const s        = cache.current[ownerFilter];

      s.events   = isFirst ? incoming : [...s.events, ...incoming];
      s.page     = page;
      // Если вернулся пустой список или меньше PAGE_SIZE — больше нет
      s.hasMore  = incoming.length >= PAGE_SIZE;
      s.isLoaded = true;

      setHasMore(s.hasMore);
      setTick(t => t + 1); // обновить рендер
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerFilter, filterKey, accountId]);

  // Первая загрузка вкладки
  useEffect(() => {
    if (!accountId) return;
    if (!cache.current[ownerFilter].isLoaded) {
      loadPage(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerFilter, filterKey, accountId]);

  const loadMore = useCallback(() => {
    const s = cache.current[ownerFilter];
    if (!s.hasMore || loadingRef.current) return;
    loadPage(s.page + 1);
  }, [ownerFilter, loadPage]);

  const events = cache.current[ownerFilter].events;

  return { events, isLoading, isLoadingMore, hasMore, error, loadMore };
}
