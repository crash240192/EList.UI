// features/event-list/useMyEvents.ts
//
// Логика:
// - Три набора ('mine', 'others', 'cancelled') и две фазы ('active', 'archive')
//   — у каждой пары свой кеш и свой API-запрос. Выбранные наборы складываются.
// - При первом открытии вкладки → делаем запрос к API
// - При повторном переключении → сразу показываем кешированные данные
// - При прокрутке до конца → загружаем следующую страницу, только если первая уже загружена
// - Пустой список в ответе → останавливаем пагинацию для этой вкладки
// - Сброс кеша при смене доп. фильтров (название, тип, дата, цена, возраст), но не при смене фазы
// - Ответ пишется в кеш своей пары и двигает UI только если она всё ещё открыта

import { useState, useEffect, useRef, useCallback } from 'react';
import type { IEvent, IEventsSearchParams } from '@/entities/event';
import { fetchEvents } from '@/entities/event';
import { eventOwnerSearchParams } from './eventOwnerSearchParams';

export type OwnerFilter = 'mine' | 'others' | 'cancelled';
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
  return { mine: emptyTab(), others: emptyTab(), cancelled: emptyTab() };
}

function emptyLoading(): Record<EventsPhase, Record<OwnerFilter, boolean>> {
  return {
    active: { mine: false, others: false, cancelled: false },
    archive: { mine: false, others: false, cancelled: false },
  };
}

/** Граница вкладки (сейчас) пересекается с «Дата от / до», не подменяя её. */
function phaseTimeParams(
  phase: EventsPhase,
  extra: Partial<IEventsSearchParams>,
  nowMs: number,
): Pick<IEventsSearchParams, 'startTime' | 'endTime' | 'orderBy'> {
  const userStartMs = extra.startTime ? Date.parse(extra.startTime) : NaN;
  const userEndMs = extra.endTime ? Date.parse(extra.endTime) : NaN;
  const hasStart = Number.isFinite(userStartMs);
  const hasEnd = Number.isFinite(userEndMs);

  if (phase === 'active') {
    const startMs = hasStart ? Math.max(userStartMs, nowMs) : nowMs;
    return {
      startTime: new Date(startMs).toISOString(),
      ...(hasEnd ? { endTime: new Date(userEndMs).toISOString() } : {}),
      orderBy: 'StartTime',
    };
  }

  const endMs = hasEnd ? Math.min(userEndMs, nowMs) : nowMs;
  return {
    ...(hasStart && userStartMs < nowMs ? { startTime: new Date(userStartMs).toISOString() } : {}),
    endTime: new Date(endMs).toISOString(),
    orderBy: 'EndTime DESC',
  };
}

// Параметры фильтра по вкладке владельца
function ownerParams(
  filter: OwnerFilter,
  accountId: string
): Pick<IEventsSearchParams, 'organizatorId' | 'participantId'> {
  switch (filter) {
    case 'mine':
      return eventOwnerSearchParams('organizer', accountId);
    case 'others':
      return eventOwnerSearchParams('participant', accountId);
    case 'cancelled':
      return eventOwnerSearchParams('all', accountId);
  }
}

interface Options {
  accountId:    string | null;
  /** Выбранные кнопки. Пустой список — пустая выдача. */
  slices:       OwnerFilter[];
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

function compareNullableNumber(a: number | null | undefined, b: number | null | undefined, desc: boolean): number {
  const av = a == null || !Number.isFinite(a) ? null : a;
  const bv = b == null || !Number.isFinite(b) ? null : b;
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  return desc ? bv - av : av - bv;
}

function mergeEvents(lists: IEvent[][], phase: EventsPhase, orderBy?: string): IEvent[] {
  const byId = new Map<string, IEvent>();
  for (const list of lists) {
    for (const event of list) byId.set(event.id, event);
  }
  const events = [...byId.values()];
  const key = (orderBy ?? '').trim().toLowerCase();
  const desc = key.includes('desc');

  events.sort((a, b) => {
    if (key.includes('agelimit') || key.includes('age_limit')) {
      return compareNullableNumber(a.parameters?.ageLimit, b.parameters?.ageLimit, desc);
    }
    if (key.includes('cost') || key.includes('price')) {
      return compareNullableNumber(a.parameters?.cost, b.parameters?.cost, desc);
    }
    if (key.includes('name')) {
      const cmp = (a.name || '').localeCompare(b.name || '', 'ru', { sensitivity: 'base' });
      return desc ? -cmp : cmp;
    }
    if (key.includes('create')) {
      // createDate в списке поиска может отсутствовать — fallback на startTime
      const aT = Date.parse((a as { createDate?: string }).createDate || a.startTime);
      const bT = Date.parse((b as { createDate?: string }).createDate || b.startTime);
      return desc ? bT - aT : aT - bT;
    }
    if (key.includes('start') || (!key && phase !== 'archive')) {
      const aT = Date.parse(a.startTime);
      const bT = Date.parse(b.startTime);
      return desc ? bT - aT : aT - bT;
    }
    if (phase === 'archive' || key.includes('end')) {
      const aEnd = Date.parse(a.endTime || a.startTime);
      const bEnd = Date.parse(b.endTime || b.startTime);
      return (desc || !key) ? bEnd - aEnd : aEnd - bEnd;
    }
    return Date.parse(a.startTime) - Date.parse(b.startTime);
  });
  return events;
}

export function useMyEvents({ accountId, slices, tab, extraParams }: Options): Result {
  // Кеш: фаза × вкладка владельца. «Прошедшие» не затирают «Активные».
  const cache = useRef<Record<EventsPhase, Record<OwnerFilter, TabState>>>({
    active: emptyOwners(),
    archive: emptyOwners(),
  });

  const loadingRef = useRef(emptyLoading());
  const slicesKey = [...slices].sort().join(',');
  const slicesRef = useRef(slices);
  slicesRef.current = slices;
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
    ageLimit:   extraParams.ageLimit,
    adultOnly:  extraParams.adultOnly === true,
    orderBy:    extraParams.orderBy || null,
  });
  const prevFilterKey = useRef(filterKey);

  if (prevFilterKey.current !== filterKey) {
    prevFilterKey.current = filterKey;
    cache.current = { active: emptyOwners(), archive: emptyOwners() };
    loadingRef.current = emptyLoading();
    generationRef.current += 1;
  }

  const selected = slicesRef.current;
  const currentLoaded = selected.some(slice => cache.current[tab][slice].isLoaded);
  const [isLoading,     setIsLoading]     = useState(selected.length > 0 && !currentLoaded);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore,       setHasMore]       = useState(
    selected.some(slice => cache.current[tab][slice].hasMore),
  );
  const [error,         setError]         = useState<string | null>(null);
  const [tick,          setTick]          = useState(0);

  useEffect(() => {
    const chosen = slicesRef.current;
    if (chosen.length === 0) {
      setHasMore(false);
      setIsLoading(false);
      setIsLoadingMore(false);
      setError(null);
      return;
    }
    const states = chosen.map(slice => cache.current[tab][slice]);
    setHasMore(states.some(state => state.hasMore));
    setIsLoading(states.every(state => !state.isLoaded));
    setIsLoadingMore(false);
    setError(null);
  }, [slicesKey, tab, filterKey]);

  const loadPage = useCallback(async (page: number, filter: OwnerFilter, phase: EventsPhase) => {
    if (!accountId || loadingRef.current[phase][filter]) return;
    loadingRef.current[phase][filter] = true;
    const generation = generationRef.current;

    const isFirst = page === 0;
    const stillViewing = () =>
      generation === generationRef.current
      && phaseRef.current === phase
      && slicesRef.current.includes(filter);

    if (stillViewing()) {
      const anyLoaded = slicesRef.current.some(slice => cache.current[phase][slice].isLoaded);
      if (isFirst && !anyLoaded) setIsLoading(true);
      else if (!isFirst) setIsLoadingMore(true);
      setError(null);
    }

    try {
      const phaseParams = phaseTimeParams(phase, extraParams, Date.now());
      const result = await fetchEvents({
        ...ownerParams(filter, accountId),
        ...phaseParams,
        name:       extraParams.name       || undefined,
        categories: extraParams.categories || undefined,
        types:      extraParams.types      || undefined,
        ...(extraParams.price != null ? { price: extraParams.price } : {}),
        ...(extraParams.ageLimit != null ? { ageLimit: extraParams.ageLimit } : {}),
        ...(extraParams.adultOnly ? { adultOnly: true } : {}),
        ...(filter === 'cancelled' ? { active: false } : {}),
        orderBy:    extraParams.orderBy || phaseParams.orderBy,
        pageIndex:  page,
        pageSize:   PAGE_SIZE,
      });

      if (generation !== generationRef.current) return;

      const raw = result?.result ?? [];
      // cancelled — только inactive; mine/others — только active (на случай смешанного ответа API).
      const filtered = filter === 'cancelled'
        ? raw.filter(event => event.active === false)
        : raw.filter(event => event.active !== false);
      // Вкладка «Я организую»: гарантируем значок организатора на обложке.
      const incoming = filter === 'mine'
        ? filtered.map(ev => ({ ...ev, isOrganizer: true as const }))
        : filtered;
      const total = typeof result?.total === 'number' ? result.total : null;
      const s = cache.current[phase][filter];

      s.events   = isFirst ? incoming : [...s.events, ...incoming];
      s.page     = page;
      s.hasMore  = raw.length >= PAGE_SIZE
        && (total == null || (page + 1) * PAGE_SIZE < total);
      s.isLoaded = true;

      if (stillViewing()) {
        const anyMore = slicesRef.current.some(slice => cache.current[phase][slice].hasMore);
        setHasMore(anyMore);
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
  }, [filterKey, accountId]);

  useEffect(() => {
    if (!accountId) return;
    for (const slice of slicesRef.current) {
      if (!cache.current[tab][slice].isLoaded) {
        void loadPage(0, slice, tab);
      }
    }
  }, [slicesKey, tab, filterKey, accountId, loadPage]);

  const loadMore = useCallback(() => {
    const phase = phaseRef.current;
    for (const filter of slicesRef.current) {
      const s = cache.current[phase][filter];
      // Пока первая страница не записана, не занимать замок запросом page 1:
      // сентинел на коротком кадре после смены вкладки иначе съедает page 0.
      if (!s.isLoaded || !s.hasMore || loadingRef.current[phase][filter]) continue;
      void loadPage(s.page + 1, filter, phase);
    }
  }, [loadPage]);

  void tick;
  const events = mergeEvents(
    slicesRef.current.map(slice => cache.current[tab][slice].events),
    tab,
    extraParams.orderBy,
  );

  return { events, isLoading, isLoadingMore, hasMore, error, loadMore };
}
