// features/event-list/useUserProfileEvents.ts
//
// Три независимых запроса с пагинацией — как на «Мои мероприятия»:
// - all: organizatorId + participantId
// - created: organizatorId
// - participating: participantId
//
// Фаза (upcoming/past) уходит на сервер: иначе ASC-пагинация без фильтра
// прячет только что закончившиеся события в конце выборки.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { IEvent, IEventsSearchParams } from '@/entities/event';
import { fetchEvents } from '@/entities/event';
import type { UserEventsScope } from './eventOwnerSearchParams';
import { eventOwnerSearchParams, userEventsScopeToOwnerScope } from './eventOwnerSearchParams';

const PAGE_SIZE = 20;
const SCOPES: UserEventsScope[] = ['all', 'created', 'participating'];

export type ProfileEventsPhase = 'upcoming' | 'past';

interface TabState {
  events: IEvent[];
  total: number;
  page: number;
  hasMore: boolean;
  isLoaded: boolean;
}

function emptyTab(): TabState {
  return { events: [], total: 0, page: 0, hasMore: true, isLoaded: false };
}

function emptyPhaseCache(): Record<UserEventsScope, TabState> {
  return {
    all: emptyTab(),
    created: emptyTab(),
    participating: emptyTab(),
  };
}

function emptyCache(): Record<ProfileEventsPhase, Record<UserEventsScope, TabState>> {
  return {
    upcoming: emptyPhaseCache(),
    past: emptyPhaseCache(),
  };
}

function phaseSearchParams(phase: ProfileEventsPhase): Pick<
  IEventsSearchParams,
  'startTime' | 'endTime' | 'orderBy'
> {
  const now = new Date().toISOString();
  if (phase === 'past') {
    return { endTime: now, orderBy: 'EndTime DESC' };
  }
  return { startTime: now, orderBy: 'StartTime' };
}

export interface UserProfileEventsScopeResult {
  events: IEvent[];
  total: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
}

interface Result {
  scopes: Record<UserEventsScope, UserProfileEventsScopeResult>;
  /** Всегда upcoming — для превью «ближайшие» в сайдбаре */
  upcomingScopes: Record<UserEventsScope, UserProfileEventsScopeResult>;
  /** Суммарные total по scope (upcoming + past), для бейджей вкладок */
  scopeTotals: Record<UserEventsScope, number>;
}

type LoadingMap = Record<ProfileEventsPhase, Record<UserEventsScope, boolean>>;

function emptyLoading(): LoadingMap {
  return {
    upcoming: { all: false, created: false, participating: false },
    past: { all: false, created: false, participating: false },
  };
}

export function useUserProfileEvents(
  accountId: string | null,
  phase: ProfileEventsPhase,
): Result {
  const cache = useRef(emptyCache());
  const loadingRef = useRef<Partial<Record<ProfileEventsPhase, Partial<Record<UserEventsScope, boolean>>>>>({});
  const prevAccountId = useRef<string | null>(null);

  const [isLoading, setIsLoading] = useState<LoadingMap>(emptyLoading);
  const [isLoadingMore, setIsLoadingMore] = useState<LoadingMap>(emptyLoading);
  const [errors, setErrors] = useState<Partial<Record<ProfileEventsPhase, Partial<Record<UserEventsScope, string | null>>>>>({});
  const [tick, setTick] = useState(0);

  if (prevAccountId.current !== accountId) {
    prevAccountId.current = accountId;
    cache.current = emptyCache();
    loadingRef.current = {};
  }

  const loadPage = useCallback(async (
    targetPhase: ProfileEventsPhase,
    scope: UserEventsScope,
    page: number,
  ) => {
    if (!accountId || loadingRef.current[targetPhase]?.[scope]) return;
    loadingRef.current[targetPhase] = {
      ...loadingRef.current[targetPhase],
      [scope]: true,
    };

    const isFirst = page === 0;
    setIsLoading(prev => ({
      ...prev,
      [targetPhase]: { ...prev[targetPhase], [scope]: isFirst },
    }));
    setIsLoadingMore(prev => ({
      ...prev,
      [targetPhase]: { ...prev[targetPhase], [scope]: !isFirst },
    }));
    setErrors(prev => ({
      ...prev,
      [targetPhase]: { ...prev[targetPhase], [scope]: null },
    }));

    try {
      const result = await fetchEvents({
        ...eventOwnerSearchParams(userEventsScopeToOwnerScope(scope), accountId),
        ...phaseSearchParams(targetPhase),
        pageIndex: page,
        pageSize: PAGE_SIZE,
      });

      const incoming = result.result ?? [];
      const tab = cache.current[targetPhase][scope];
      tab.events = isFirst ? incoming : [...tab.events, ...incoming];
      tab.total = result.total ?? tab.events.length;
      tab.page = page;
      tab.hasMore = incoming.length >= PAGE_SIZE && (page + 1) * PAGE_SIZE < tab.total;
      tab.isLoaded = true;
      setTick(t => t + 1);
    } catch (e) {
      setErrors(prev => ({
        ...prev,
        [targetPhase]: {
          ...prev[targetPhase],
          [scope]: e instanceof Error ? e.message : 'Ошибка загрузки',
        },
      }));
    } finally {
      loadingRef.current[targetPhase] = {
        ...loadingRef.current[targetPhase],
        [scope]: false,
      };
      setIsLoading(prev => ({
        ...prev,
        [targetPhase]: { ...prev[targetPhase], [scope]: false },
      }));
      setIsLoadingMore(prev => ({
        ...prev,
        [targetPhase]: { ...prev[targetPhase], [scope]: false },
      }));
    }
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;
    // Обе фазы: корректные бейджи + превью upcoming + список текущей фазы
    for (const p of ['upcoming', 'past'] as ProfileEventsPhase[]) {
      for (const scope of SCOPES) {
        if (!cache.current[p][scope].isLoaded) {
          void loadPage(p, scope, 0);
        }
      }
    }
  }, [accountId, loadPage]);

  const loadMore = useCallback((targetPhase: ProfileEventsPhase, scope: UserEventsScope) => {
    const tab = cache.current[targetPhase][scope];
    if (!tab.hasMore || loadingRef.current[targetPhase]?.[scope]) return;
    void loadPage(targetPhase, scope, tab.page + 1);
  }, [loadPage]);

  const buildScopes = useCallback((
    targetPhase: ProfileEventsPhase,
  ): Record<UserEventsScope, UserProfileEventsScopeResult> => {
    void tick;
    return {
      all: {
        events: cache.current[targetPhase].all.events,
        total: cache.current[targetPhase].all.total,
        isLoading: isLoading[targetPhase].all,
        isLoadingMore: isLoadingMore[targetPhase].all,
        hasMore: cache.current[targetPhase].all.hasMore,
        error: errors[targetPhase]?.all ?? null,
        loadMore: () => loadMore(targetPhase, 'all'),
      },
      created: {
        events: cache.current[targetPhase].created.events,
        total: cache.current[targetPhase].created.total,
        isLoading: isLoading[targetPhase].created,
        isLoadingMore: isLoadingMore[targetPhase].created,
        hasMore: cache.current[targetPhase].created.hasMore,
        error: errors[targetPhase]?.created ?? null,
        loadMore: () => loadMore(targetPhase, 'created'),
      },
      participating: {
        events: cache.current[targetPhase].participating.events,
        total: cache.current[targetPhase].participating.total,
        isLoading: isLoading[targetPhase].participating,
        isLoadingMore: isLoadingMore[targetPhase].participating,
        hasMore: cache.current[targetPhase].participating.hasMore,
        error: errors[targetPhase]?.participating ?? null,
        loadMore: () => loadMore(targetPhase, 'participating'),
      },
    };
  }, [tick, isLoading, isLoadingMore, errors, loadMore]);

  const scopes = useMemo(() => buildScopes(phase), [buildScopes, phase]);
  const upcomingScopes = useMemo(() => buildScopes('upcoming'), [buildScopes]);

  const scopeTotals = useMemo((): Record<UserEventsScope, number> => {
    void tick;
    const sum = (scope: UserEventsScope) =>
      (cache.current.upcoming[scope].total || 0) + (cache.current.past[scope].total || 0);
    return {
      all: sum('all'),
      created: sum('created'),
      participating: sum('participating'),
    };
  }, [tick]);

  return { scopes, upcomingScopes, scopeTotals };
}
