// features/notifications/notificationsStore.ts

import { create } from 'zustand';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/entities/notification/api';
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
  applyMarkRead: (id: string, readAt?: string) => void;
  applyMarkAllRead: (readAt?: string) => void;
  markRead: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  reset: () => void;
}

function sortByDate(items: INotification[]): INotification[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
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

  applyMarkRead: (id, readAt) => {
    const at = readAt ?? new Date().toISOString();
    set(s => ({
      items: s.items.map(i => (i.id === id && !i.readAt ? { ...i, readAt: at } : i)),
    }));
  },

  applyMarkAllRead: readAt => {
    const at = readAt ?? new Date().toISOString();
    set(s => ({
      items: s.items.map(i => (i.readAt ? i : { ...i, readAt: at })),
    }));
  },

  markRead: async id => {
    const item = get().items.find(i => i.id === id);
    if (!item || item.readAt) return;

    const prev = get().items;
    get().applyMarkRead(id);
    try {
      await markNotificationRead(id);
    } catch {
      set({ items: prev });
    }
  },

  clearAll: async () => {
    if (!get().items.some(i => !i.readAt)) return;

    const prev = get().items;
    get().applyMarkAllRead();
    try {
      await markAllNotificationsRead();
    } catch {
      set({ items: prev });
    }
  },

  reset: () => set({ items: [], wsStatus: 'idle', wsError: null, panelOpen: false }),
}));
