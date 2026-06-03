// features/invitations/invitationsStore.ts

import { useEffect } from 'react';
import { create } from 'zustand';
import { fetchNotViewedInvitationsCount } from '@/entities/invitation/invitationsApi';

interface InvitationsState {
  notViewedCount: number;
  loadingCount: boolean;
  refreshNotViewedCount: () => Promise<void>;
  incrementNotViewedCount: () => void;
  applyMarkedViewed: () => void;
  reset: () => void;
}

export const useInvitationsStore = create<InvitationsState>((set) => ({
  notViewedCount: 0,
  loadingCount: false,

  refreshNotViewedCount: async () => {
    set({ loadingCount: true });
    try {
      const count = await fetchNotViewedInvitationsCount();
      set({ notViewedCount: count });
    } catch {
      /* оставляем предыдущее значение */
    } finally {
      set({ loadingCount: false });
    }
  },

  incrementNotViewedCount: () => {
    set(s => ({ notViewedCount: s.notViewedCount + 1 }));
  },

  applyMarkedViewed: () => {
    set(s => ({ notViewedCount: Math.max(0, s.notViewedCount - 1) }));
  },

  reset: () => set({ notViewedCount: 0, loadingCount: false }),
}));

/** Загрузка счётчика при открытии приложения (авторизованный пользователь) */
export function useInvitationsNotViewedCount(enabled: boolean): void {
  const refresh = useInvitationsStore(s => s.refreshNotViewedCount);
  const reset = useInvitationsStore(s => s.reset);

  useEffect(() => {
    if (!enabled) {
      reset();
      return;
    }
    void refresh();
  }, [enabled, refresh, reset]);
}
