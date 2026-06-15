// features/event/useEventOrganizers.ts
// Единая проверка организатора мероприятия через GET /api/EventOrganizators/getByEventId/{eventId}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchEventOrganizators, type IEventOrganizator } from '@/entities/event';
import { isAccessDeniedError } from '@/shared/api/apiErrorUtils';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export function isEventOrganizer(
  organizers: IEventOrganizator[],
  accountId: string | null | undefined,
): boolean {
  return !!accountId && organizers.some((o) => o.accountId === accountId);
}

interface UseEventOrganizersOptions {
  enabled?: boolean;
  /** В mock-режиме считать текущего пользователя организатором */
  mockAsOrganizer?: boolean;
}

export function useEventOrganizers(
  eventId: string | undefined,
  accountId: string | null,
  options: UseEventOrganizersOptions = {},
) {
  const { enabled = true, mockAsOrganizer = false } = options;

  const [organizers, setOrganizers] = useState<IEventOrganizator[]>([]);
  const [loading, setLoading] = useState(!!eventId && enabled);
  const [denied, setDenied] = useState(false);

  const refetch = useCallback(async () => {
    if (!eventId || !enabled) {
      setOrganizers([]);
      setLoading(false);
      setDenied(false);
      return;
    }

    if (USE_MOCK && mockAsOrganizer) {
      setOrganizers([]);
      setDenied(false);
      setLoading(false);
      return;
    }

    if (USE_MOCK) {
      setOrganizers([]);
      setDenied(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setDenied(false);
    try {
      const orgs = await fetchEventOrganizators(eventId);
      setOrganizers(orgs);
    } catch (e: unknown) {
      setOrganizers([]);
      if (isAccessDeniedError(e)) setDenied(true);
    } finally {
      setLoading(false);
    }
  }, [eventId, enabled, mockAsOrganizer]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const isOrganizer = useMemo(() => {
    if (USE_MOCK && mockAsOrganizer && accountId) return true;
    return isEventOrganizer(organizers, accountId);
  }, [organizers, accountId, mockAsOrganizer]);

  const organizerIds = useMemo(
    () => new Set(organizers.map((o) => o.accountId)),
    [organizers],
  );

  return { organizers, isOrganizer, organizerIds, loading, denied, refetch };
}
