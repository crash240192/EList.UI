// features/event-list/useMyEvents.ts
//
// Логика:
// - Три вкладки ('all', 'mine', 'others') — у каждой свой кеш и свой API-запрос
// - При первом открытии вкладки → делаем запрос к API
// - При повторном переключении → сразу показываем кешированные данные
// - При прокрутке до конца → загружаем следующую страницу
// - Пустой список в ответе → останавливаем пагинацию для этой вкладки
// - Сброс всего кеша при смене доп. фильтров (название, тип, дата, цена)
// - Ответ записывается в кеш своей вкладки и двигает UI только если она всё ещё открыта

import { useState, useEffect, useRef, useCallback } from 'react';
import type { IEvent, IEventsSearchParams } from '@/entities/event';
import { fetchEvents } from '@/entities/event';
import { eventOwnerSearchParams } from './eventOwnerSearchParams';

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
    case 'mine':
      return eventOwnerSearchParams('organizer', accountId);
    case 'others':
      return eventOwnerSearchParams('participant', accountId);
    case 'all':
    default:
      return eventOwnerSearchParams('all', accountId);
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

  // Отдельный замок на вкладку: ответ «Организую» не должен снимать загрузку «Все мои»
  const loadingRef = useRef<Record<OwnerFilter, boolean>>({
    all: false,
    mine: false,
    others: false,
  });
  const ownerFilterRef = useRef(ownerFilter);
  ownerFilterRef.current = ownerFilter;
  const generationRef = useRef(0);

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
    loadingRef.current = { all: false, mine: false, others: false };
    generationRef.current += 1;
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
    setIsLoadingMore(false);
    setError(null);
  }, [ownerFilter, filterKey]);

  const includeInactive = extraParams.active === false;

  // Функция загрузки страницы. filter фиксируется в момент вызова,
  // чтобы поздний ответ ушёл в кеш той вкладки, которая его запросила.
  const loadPage = useCallback(async (page: number, filter: OwnerFilter) => {
    if (!accountId || loadingRef.current[filter]) return;
    loadingRef.current[filter] = true;
    const generation = generationRef.current;

    const isFirst = page === 0;
    const stillViewing = () =>
      generation === generationRef.current && ownerFilterRef.current === filter;

    if (stillViewing()) {
      if (isFirst) setIsLoading(true);
      else setIsLoadingMore(true);
      setError(null);
    }

    try {
      const result = await fetchEvents({
        ...ownerParams(filter, accountId),
        // Активные: startTime = сейчас (ещё идут или впереди) — ближайшие сверху
        // Прошедшие: endTime = сейчас — только что закончившиеся сверху (EndTime DESC)
        ...(tab === 'active'
          ? { startTime: new Date().toISOString(), orderBy: 'StartTime' }
          : {}),
        ...(tab === 'archive'
          ? { endTime: new Date().toISOString(), orderBy: 'EndTime DESC' }
          : {}),
        name:       extraParams.name       || undefined,
        categories: extraParams.categories || undefined,
        types:      extraParams.types      || undefined,
        price:      extraParams.price      || undefined,
        ...(includeInactive && filter === 'mine' ? { active: false } : {}),
        pageIndex:  page,
        pageSize:   PAGE_SIZE,
      });

      if (generation !== generationRef.current) return;

      const incoming = result?.result ?? [];
      const total = typeof result?.total === 'number' ? result.total : null;
      const s = cache.current[filter];

      s.events   = isFirst ? incoming : [...s.events, ...incoming];
      s.page     = page;
      // Полная страница и total ещё не исчерпан — есть следующая
      s.hasMore  = incoming.length >= PAGE_SIZE
        && (total == null || (page + 1) * PAGE_SIZE < total);
      s.isLoaded = true;

      if (stillViewing()) {
        setHasMore(s.hasMore);
        setTick(t => t + 1);
      }
    } catch (e) {
      if (stillViewing()) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      }
    } finally {
      if (generation === generationRef.current) {
        loadingRef.current[filter] = false;
      }
      if (stillViewing()) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, accountId, includeInactive]);

  // Первая загрузка вкладки
  useEffect(() => {
    if (!accountId) return;
    if (!cache.current[ownerFilter].isLoaded) {
      void loadPage(0, ownerFilter);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerFilter, filterKey, accountId, loadPage]);

  const loadMore = useCallback(() => {
    const s = cache.current[ownerFilter];
    if (!s.hasMore || loadingRef.current[ownerFilter]) return;
    void loadPage(s.page + 1, ownerFilter);
  }, [ownerFilter, loadPage]);

  void tick;
  const events = cache.current[ownerFilter].events;

  return { events, isLoading, isLoadingMore, hasMore, error, loadMore };
}
