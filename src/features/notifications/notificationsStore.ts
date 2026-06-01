// features/notifications/notificationsStore.ts

import { create } from 'zustand';
import type { INotification, NotificationWsStatus } from '@/entities/notification/types';

const MAX_ITEMS = 80;

interface NotificationsState {
  items: INotification[];
  wsStatus: NotificationWsStatus;
  wsError: string | null;
  panelOpen: boolean;
  setWsStatus: (status: NotificationWsStatus, error?: string | null) => void;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  pushNotification: (n: INotification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  reset: () => void;
}

function sortByDate(items: INotification[]): INotification[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export const useNotificationsStore = create<NotificationsState>(set => ({
  items: [],
  wsStatus: 'idle',
  wsError: null,
  panelOpen: false,

  setWsStatus: (wsStatus, wsError = null) => set({ wsStatus, wsError }),

  setPanelOpen: panelOpen => set({ panelOpen }),

  togglePanel: () => set(s => ({ panelOpen: !s.panelOpen })),

  pushNotification: n => {
    set(s => {
      const without = s.items.filter(i => i.id !== n.id);
      const items = sortByDate([n, ...without]).slice(0, MAX_ITEMS);
      return { items };
    });
  },

  markRead: id => {
    const now = new Date().toISOString();
    set(s => ({
      items: s.items.map(i => (i.id === id && !i.readAt ? { ...i, readAt: now } : i)),
    }));
  },

  markAllRead: () => {
    const now = new Date().toISOString();
    set(s => ({
      items: s.items.map(i => (i.readAt ? i : { ...i, readAt: now })),
    }));
  },

  clearAll: () => set({ items: [] }),

  reset: () => set({ items: [], wsStatus: 'idle', wsError: null, panelOpen: false }),
}));
