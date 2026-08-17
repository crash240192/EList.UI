// features/notifications/notificationsStore.ts

import { create } from 'zustand';
import {
  fetchMyNotifications,
  fetchMyNotificationsUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/entities/notification/api';
import type { INotification, NotificationWsStatus } from '@/entities/notification/types';

const MAX_ITEMS = 80;

interface NotificationsState {
  items: INotification[];
  unreadCount: number;
  historyLoaded: boolean;
  historyLoading: boolean;
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
  loadHistory: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  reset: () => void;
}

function sortByDate(items: INotification[]): INotification[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function mergeNotifications(
  existing: INotification[],
  incoming: INotification[],
): INotification[] {
  const byId = new Map<string, INotification>();
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  for (const item of existing) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }
  return sortByDate(Array.from(byId.values())).slice(0, MAX_ITEMS);
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unreadCount: 0,
  historyLoaded: false,
  historyLoading: false,
  wsStatus: 'idle',
  wsError: null,
  panelOpen: false,

  setWsStatus: (wsStatus, wsError = null) => set({ wsStatus, wsError }),

  setPanelOpen: panelOpen => set({ panelOpen }),

  togglePanel: () => set(s => ({ panelOpen: !s.panelOpen })),

  pushNotification: n => {
    set(s => {
      const items = mergeNotifications(s.items, [n]);
      const wasUnread = s.items.find(i => i.id === n.id)?.readAt == null;
      const isUnread = n.readAt == null;
      let unreadCount = s.unreadCount;
      if (isUnread && !wasUnread) unreadCount += 1;
      return { items, unreadCount };
    });
  },

  applyMarkRead: (id, readAt) => {
    const at = readAt ?? new Date().toISOString();
    set(s => {
      const target = s.items.find(i => i.id === id);
      if (!target || target.readAt) return s;
      return {
        items: s.items.map(i => (i.id === id ? { ...i, readAt: at } : i)),
        unreadCount: Math.max(0, s.unreadCount - 1),
      };
    });
  },

  applyMarkAllRead: readAt => {
    const at = readAt ?? new Date().toISOString();
    set(s => ({
      items: s.items.map(i => (i.readAt ? i : { ...i, readAt: at })),
      unreadCount: 0,
    }));
  },

  markRead: async id => {
    const item = get().items.find(i => i.id === id);
    if (!item || item.readAt) return;

    const prev = get().items;
    const prevUnread = get().unreadCount;
    get().applyMarkRead(id);
    try {
      await markNotificationRead(id);
    } catch {
      set({ items: prev, unreadCount: prevUnread });
    }
  },

  clearAll: async () => {
    if (!get().items.some(i => !i.readAt)) return;

    const prev = get().items;
    const prevUnread = get().unreadCount;
    get().applyMarkAllRead();
    try {
      await markAllNotificationsRead();
    } catch {
      set({ items: prev, unreadCount: prevUnread });
    }
  },

  loadHistory: async () => {
    if (get().historyLoading) return;
    set({ historyLoading: true });
    try {
      const page = await fetchMyNotifications({ pageIndex: 0, pageSize: 50 });
      set(s => ({
        items: mergeNotifications(s.items, page.result),
        historyLoaded: true,
      }));
      await get().refreshUnreadCount();
    } catch (err) {
      console.error('[notifications] load history failed', err);
    } finally {
      set({ historyLoading: false });
    }
  },

  refreshUnreadCount: async () => {
    try {
      const count = await fetchMyNotificationsUnreadCount();
      set({ unreadCount: count });
    } catch (err) {
      console.error('[notifications] unread count failed', err);
    }
  },

  reset: () => set({
    items: [],
    unreadCount: 0,
    historyLoaded: false,
    historyLoading: false,
    wsStatus: 'idle',
    wsError: null,
    panelOpen: false,
  }),
}));
