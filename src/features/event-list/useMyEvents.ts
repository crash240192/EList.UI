// features/event-list/useMyEvents.ts
//
// Логика:
// - Три вкладки владельца ('all', 'mine', 'others') и две фазы ('active', 'archive')
//   — у каждой пары свой кеш и свой API-запрос
// - При первом открытии вкладки → делаем запрос к API
// - При повторном переключении → сразу показываем кешированные данные
// - При прокрутке до конца → загружаем следующую страницу, только если первая уже загружена
// - Пустой список в ответе → останавливаем пагинацию для этой вкладки
// - Сброс кеша при смене доп. фильтров (название, тип, дата, цена, отменённые), но не при смене фазы
// - Ответ пишется в кеш своей пары и двигает UI только если она всё ещё открыта

import { useState, useEffect, useRef, useCallback } from 'react';
import type { IEvent, IEventsSearchParams } from '@/entities/event';
import { fetchEvents } from '@/entities/event';
import { eventOwnerSearchParams } from './eventOwnerSearchParams';

export type OwnerFilter = 'all' | 'mine' | 'others';
export type EventsPhase = 'active' | 'archive';

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

function emptyOwners(): Record<OwnerFilter, TabState> {
  return { all: emptyTab(), mine: emptyTab(), others: emptyTab() };
}

function emptyLoading(): Record<EventsPhase, Record<OwnerFilter, boolean>> {
  return {
    active: { all: false, mine: false, others: false },
    archive: { all: false, mine: false, others: false },
  };
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
  tab:          EventsPhase;
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
  // Кеш: фаза × вкладка владельца. «Прошедшие» не затирают «Активные».
  const cache = useRef<Record<EventsPhase, Record<OwnerFilter, TabState>>>({
    active: emptyOwners(),
    archive: emptyOwners(),
  });

  const loadingRef = useRef(emptyLoading());
  const ownerFilterRef = useRef(ownerFilter);
  ownerFilterRef.current = ownerFilter;
  const phaseRef = useRef(tab);
  phaseRef.current = tab;
  const generationRef = useRef(0);

  // Ключ для сброса кеша при смене фильтров. Фаза и вкладка владельца сюда не входят.
  const filterKey = JSON.stringify({
    accountId,
    name:       extraParams.name,
    categories: extraParams.categories,
    types:      extraParams.types,
    startTime:  extraParams.startTime,
    endTime:    extraParams.endTime,
    price:      extraParams.price,
    includeInactive: extraParams.active === false,
  });
  const prevFilterKey = useRef(filterKey);

  if (prevFilterKey.current !== filterKey) {
    prevFilterKey.current = filterKey;
    cache.current = { active: emptyOwners(), archive: emptyOwners() };
    loadingRef.current = emptyLoading();
    generationRef.current += 1;
  }

  const current = cache.current[tab][ownerFilter];
  const [isLoading,     setIsLoading]     = useState(!current.isLoaded);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore,       setHasMore]       = useState(current.hasMore);
  const [error,         setError]         = useState<string | null>(null);
  const [tick,          setTick]          = useState(0);

  useEffect(() => {
    const s = cache.current[tab][ownerFilter];
    setHasMore(s.hasMore);
    setIsLoading(!s.isLoaded);
    setIsLoadingMore(false);
    setError(null);
  }, [ownerFilter, tab, filterKey]);

  const includeInactive = extraParams.active === false;

  const loadPage = useCallback(async (page: number, filter: OwnerFilter, phase: EventsPhase) => {
    if (!accountId || loadingRef.current[phase][filter]) return;
    loadingRef.current[phase][filter] = true;
    const generation = generationRef.current;

    const isFirst = page === 0;
    const stillViewing = () =>
      generation === generationRef.current
      && ownerFilterRef.current === filter
      && phaseRef.current === phase;

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
        ...(phase === 'active'
          ? { startTime: new Date().toISOString(), orderBy: 'StartTime' }
          : { endTime: new Date().toISOString(), orderBy: 'EndTime DESC' }),
        name:       extraParams.name       || undefined,
        categories: extraParams.categories || undefined,
        types:      extraParams.types      || undefined,
        price:      extraParams.price      || undefined,
        ...(includeInactive ? { active: false } : {}),
        pageIndex:  page,
        pageSize:   PAGE_SIZE,
      });

      if (generation !== generationRef.current) return;

      const incoming = result?.result ?? [];
      const total = typeof result?.total === 'number' ? result.total : null;
      const s = cache.current[phase][filter];

      s.events   = isFirst ? incoming : [...s.events, ...incoming];
      s.page     = page;
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
        loadingRef.current[phase][filter] = false;
      }
      if (stillViewing()) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, accountId, includeInactive]);

  useEffect(() => {
    if (!accountId) return;
    if (!cache.current[tab][ownerFilter].isLoaded) {
      void loadPage(0, ownerFilter, tab);
    }
  }, [ownerFilter, tab, filterKey, accountId, loadPage]);

  const loadMore = useCallback(() => {
    const phase = phaseRef.current;
    const filter = ownerFilterRef.current;
    const s = cache.current[phase][filter];
    // Пока первая страница не записана, не занимать замок запросом page 1:
    // сентинел на коротком кадре после смены вкладки иначе съедает page 0.
    if (!s.isLoaded || !s.hasMore || loadingRef.current[phase][filter]) return;
    void loadPage(s.page + 1, filter, phase);
  }, [loadPage]);

  void tick;
  const events = cache.current[tab][ownerFilter].events;

  return { events, isLoading, isLoadingMore, hasMore, error, loadMore };
}
