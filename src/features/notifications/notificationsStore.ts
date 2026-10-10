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
/** Пауза, чтобы пачка replay при подключении сокета схлопнулась в один запрос счётчика. */
const UNREAD_REFRESH_DEBOUNCE_MS = 300;

/** Инвалидирует in-flight loadHistory после mark-read / mark-all. */
let historyEpoch = 0;
/** Инвалидирует устаревший ответ /my/count, если запрос счётчика ушёл ещё раз. */
let unreadCountEpoch = 0;
let unreadRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleUnreadCountRefresh(): void {
  if (unreadRefreshTimer) clearTimeout(unreadRefreshTimer);
  unreadRefreshTimer = setTimeout(() => {
    unreadRefreshTimer = null;
    void useNotificationsStore.getState().refreshUnreadCount();
  }, UNREAD_REFRESH_DEBOUNCE_MS);
}

function clearUnreadCountRefresh(): void {
  if (!unreadRefreshTimer) return;
  clearTimeout(unreadRefreshTimer);
  unreadRefreshTimer = null;
}

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
  /** true — сервер подтвердил; false — откатили локальное состояние */
  clearAll: () => Promise<boolean>;
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
  for (const item of existing) {
    byId.set(item.id, item);
  }
  for (const item of incoming) {
    const prev = byId.get(item.id);
    // Prefer payload that still has usable deep-link scalars (WS Newtonsoft vs broken REST history).
    let next: INotification = prev
      && notificationDataHasMessageRef(prev.data)
      && !notificationDataHasMessageRef(item.data)
      ? { ...item, data: prev.data }
      : item;

    // Не откатываем локально прочитанное: stale history / WS replay с readAt=null
    // иначе после «прочитать все» уведомления снова всплывают как новые.
    if (prev?.readAt && !next.readAt) {
      next = { ...next, readAt: prev.readAt };
    }

    byId.set(item.id, next);
  }
  return sortByDate(Array.from(byId.values())).slice(0, MAX_ITEMS);
}

function notificationDataHasMessageRef(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const o = data as Record<string, unknown>;
  const id = o.id ?? o.Id ?? o.messageId ?? o.MessageId;
  if (id == null || Array.isArray(id) || typeof id === 'object') return false;
  return String(id).trim() !== '';
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
    let refreshUnread = false;
    set(s => {
      const prev = s.items.find(i => i.id === n.id);
      const items = mergeNotifications(s.items, [n]);
      const merged = items.find(i => i.id === n.id);
      const wasUnread = prev ? prev.readAt == null : false;
      const isUnread = merged?.readAt == null;
      let unreadCount = s.unreadCount;
      // Неизвестное уведомление уже входит в ответ /my/count (replay при подключении)
      // либо появилось после него. Локальный +1 удваивает бейдж после обновления страницы.
      // Актуальное число подтянет refreshUnreadCount.
      if (!prev) {
        refreshUnread = isUnread;
      } else if (isUnread && !wasUnread) {
        unreadCount += 1;
      } else if (!isUnread && wasUnread) {
        unreadCount = Math.max(0, unreadCount - 1);
      }
      return { items, unreadCount };
    });
    if (refreshUnread) scheduleUnreadCountRefresh();
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
    historyEpoch += 1;
    get().applyMarkRead(id);
    try {
      await markNotificationRead(id);
      await get().refreshUnreadCount();
    } catch {
      set({ items: prev, unreadCount: prevUnread });
    }
  },

  clearAll: async () => {
    if (!get().items.some(i => !i.readAt)) return true;

    const prev = get().items;
    const prevUnread = get().unreadCount;
    historyEpoch += 1;
    get().applyMarkAllRead();
    try {
      await markAllNotificationsRead();
      await get().refreshUnreadCount();
      return true;
    } catch {
      set({ items: prev, unreadCount: prevUnread });
      return false;
    }
  },

  loadHistory: async () => {
    if (get().historyLoading) return;
    const epoch = historyEpoch;
    set({ historyLoading: true });
    try {
      const page = await fetchMyNotifications({ pageIndex: 0, pageSize: 50 });
      if (epoch !== historyEpoch) return;
      set(s => ({
        items: mergeNotifications(s.items, page.result),
        historyLoaded: true,
      }));
      if (epoch !== historyEpoch) return;
      await get().refreshUnreadCount();
    } catch (err) {
      console.error('[notifications] load history failed', err);
    } finally {
      set({ historyLoading: false });
    }
  },

  refreshUnreadCount: async () => {
    const epoch = ++unreadCountEpoch;
    try {
      const count = await fetchMyNotificationsUnreadCount();
      if (epoch !== unreadCountEpoch) return;
      set({ unreadCount: count });
    } catch (err) {
      console.error('[notifications] unread count failed', err);
    }
  },

  reset: () => {
    historyEpoch += 1;
    unreadCountEpoch += 1;
    clearUnreadCountRefresh();
    set({
      items: [],
      unreadCount: 0,
      historyLoaded: false,
      historyLoading: false,
      wsStatus: 'idle',
      wsError: null,
      panelOpen: false,
    });
  },
}));
