// features/event/useEventOrganizers.ts
// Список организаторов + проверка через GET /api/EventOrganizators/isOrganizator/{eventId}

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  checkIsEventOrganizator,
  fetchEventOrganizators,
  type IEventOrganizator,
} from '@/entities/event';
import { isAccessDeniedError } from '@/shared/api/apiErrorUtils';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

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
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [loading, setLoading] = useState(!!eventId && enabled);
  const [denied, setDenied] = useState(false);

  const refetch = useCallback(async () => {
    if (!eventId || !enabled) {
      setOrganizers([]);
      setIsOrganizer(false);
      setLoading(false);
      setDenied(false);
      return;
    }

    if (USE_MOCK) {
      setOrganizers([]);
      setIsOrganizer(Boolean(mockAsOrganizer && accountId));
      setDenied(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setDenied(false);
    try {
      const [orgs, organizerFlag] = await Promise.all([
        fetchEventOrganizators(eventId).catch((e: unknown) => {
          if (isAccessDeniedError(e)) setDenied(true);
          return [] as IEventOrganizator[];
        }),
        accountId
          ? checkIsEventOrganizator(eventId)
          : Promise.resolve(false),
      ]);
      setOrganizers(orgs);
      setIsOrganizer(organizerFlag);
    } catch {
      setOrganizers([]);
      setIsOrganizer(false);
    } finally {
      setLoading(false);
    }
  }, [eventId, enabled, mockAsOrganizer, accountId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  /** Account IDs персональных организаторов (для участников / модалки добавления) */
  const organizerIds = useMemo(
    () => new Set(
      organizers
        .map((o) => o.accountId)
        .filter((id): id is string => Boolean(id)),
    ),
    [organizers],
  );

  return { organizers, isOrganizer, organizerIds, loading, denied, refetch };
}
