// features/presence/useOnlinePresence.ts

import { useEffect } from 'react';
import { usePresenceStore } from './presenceStore';

/** Подписка на онлайн-статус аккаунта (батч-опрос WS presence) */
export function useOnlinePresence(accountId: string | null | undefined): boolean {
  const id = accountId?.trim() || '';
  const online = usePresenceStore(s => (id ? Boolean(s.onlineById[id]) : false));
  const watch = usePresenceStore(s => s.watch);
  const unwatch = usePresenceStore(s => s.unwatch);

  useEffect(() => {
    if (!id) return;
    watch(id);
    return () => unwatch(id);
  }, [id, watch, unwatch]);

  return online;
}
