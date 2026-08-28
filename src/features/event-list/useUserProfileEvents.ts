// features/event-list/useUserProfileEvents.ts
//
// Три независимых запроса с пагинацией — как на «Мои мероприятия»:
// - all: organizatorId + participantId
// - created: organizatorId
// - participating: participantId

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { IEvent } from '@/entities/event';
import { fetchEvents } from '@/entities/event';
import type { UserEventsScope } from './eventOwnerSearchParams';
import { eventOwnerSearchParams, userEventsScopeToOwnerScope } from './eventOwnerSearchParams';

const PAGE_SIZE = 20;
const SCOPES: UserEventsScope[] = ['all', 'created', 'participating'];

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

function emptyCache(): Record<UserEventsScope, TabState> {
  return {
    all: emptyTab(),
    created: emptyTab(),
    participating: emptyTab(),
  };
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
}

export function useUserProfileEvents(accountId: string | null): Result {
  const cache = useRef<Record<UserEventsScope, TabState>>(emptyCache());
  const loadingRef = useRef<Partial<Record<UserEventsScope, boolean>>>({});
  const prevAccountId = useRef<string | null>(null);

  const [isLoading, setIsLoading] = useState<Record<UserEventsScope, boolean>>({
    all: false,
    created: false,
    participating: false,
  });
  const [isLoadingMore, setIsLoadingMore] = useState<Record<UserEventsScope, boolean>>({
    all: false,
    created: false,
    participating: false,
  });
  const [errors, setErrors] = useState<Partial<Record<UserEventsScope, string | null>>>({});
  const [tick, setTick] = useState(0);

  if (prevAccountId.current !== accountId) {
    prevAccountId.current = accountId;
    cache.current = emptyCache();
    loadingRef.current = {};
  }

  const loadPage = useCallback(async (scope: UserEventsScope, page: number) => {
    if (!accountId || loadingRef.current[scope]) return;
    loadingRef.current[scope] = true;

    const isFirst = page === 0;
    setIsLoading(prev => ({ ...prev, [scope]: isFirst }));
    setIsLoadingMore(prev => ({ ...prev, [scope]: !isFirst }));
    setErrors(prev => ({ ...prev, [scope]: null }));

    try {
      const result = await fetchEvents({
        ...eventOwnerSearchParams(userEventsScopeToOwnerScope(scope), accountId),
        pageIndex: page,
        pageSize: PAGE_SIZE,
      });

      const incoming = result.result ?? [];
      const tab = cache.current[scope];
      tab.events = isFirst ? incoming : [...tab.events, ...incoming];
      tab.total = result.total ?? tab.events.length;
      tab.page = page;
      tab.hasMore = incoming.length >= PAGE_SIZE && (page + 1) * PAGE_SIZE < tab.total;
      tab.isLoaded = true;
      setTick(t => t + 1);
    } catch (e) {
      setErrors(prev => ({
        ...prev,
        [scope]: e instanceof Error ? e.message : 'Ошибка загрузки',
      }));
    } finally {
      loadingRef.current[scope] = false;
      setIsLoading(prev => ({ ...prev, [scope]: false }));
      setIsLoadingMore(prev => ({ ...prev, [scope]: false }));
    }
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;
    for (const scope of SCOPES) {
      if (!cache.current[scope].isLoaded) {
        void loadPage(scope, 0);
      }
    }
  }, [accountId, loadPage]);

  const loadMore = useCallback((scope: UserEventsScope) => {
    const tab = cache.current[scope];
    if (!tab.hasMore || loadingRef.current[scope]) return;
    void loadPage(scope, tab.page + 1);
  }, [loadPage]);

  const scopes = useMemo((): Record<UserEventsScope, UserProfileEventsScopeResult> => {
    void tick;
    return {
      all: {
        events: cache.current.all.events,
        total: cache.current.all.total,
        isLoading: isLoading.all,
        isLoadingMore: isLoadingMore.all,
        hasMore: cache.current.all.hasMore,
        error: errors.all ?? null,
        loadMore: () => loadMore('all'),
      },
      created: {
        events: cache.current.created.events,
        total: cache.current.created.total,
        isLoading: isLoading.created,
        isLoadingMore: isLoadingMore.created,
        hasMore: cache.current.created.hasMore,
        error: errors.created ?? null,
        loadMore: () => loadMore('created'),
      },
      participating: {
        events: cache.current.participating.events,
        total: cache.current.participating.total,
        isLoading: isLoading.participating,
        isLoadingMore: isLoadingMore.participating,
        hasMore: cache.current.participating.hasMore,
        error: errors.participating ?? null,
        loadMore: () => loadMore('participating'),
      },
    };
  }, [tick, isLoading, isLoadingMore, errors, loadMore]);

  return { scopes };
}
