// features/presence/useOnlinePresence.ts

import { useEffect } from 'react';
import { isAuthenticated } from '@/shared/api/client';
import { usePresenceStore } from './presenceStore';

/** Подписка на онлайн-статус аккаунта (батч-опрос /notifications/online). Гостям не нужен. */
export function useOnlinePresence(accountId: string | null | undefined): boolean {
  const id = accountId?.trim().toLowerCase() || '';
  const online = usePresenceStore(s => (id ? Boolean(s.onlineById[id]) : false));
  const watch = usePresenceStore(s => s.watch);
  const unwatch = usePresenceStore(s => s.unwatch);

  useEffect(() => {
    if (!id || !isAuthenticated()) return;
    watch(id);
    return () => unwatch(id);
  }, [id, watch, unwatch]);

  return online;
}
