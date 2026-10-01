// features/presence/presenceStore.ts — онлайн по notifications WebSocket

import { create } from 'zustand';
import { isAuthenticated } from '@/shared/api/client';
import { fetchOnlineAccountIds } from '@/entities/notification/api';

const POLL_MS = 20_000;
const DEBOUNCE_MS = 350;
const MAX_BATCH = 100;
/** Не гасим зелёный кружок сразу: API/WS могут мигнуть, пока человек ещё на сайте */
const OFFLINE_GRACE_MS = 60_000;

interface PresenceState {
  /** accountId → online */
  onlineById: Record<string, boolean>;
  /** сколько аватаров сейчас следят за id */
  watchers: Record<string, number>;
  watch: (accountId: string) => void;
  unwatch: (accountId: string) => void;
  refresh: () => Promise<void>;
  setSelfOnline: (accountId: string | null, online: boolean) => void;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let refreshInFlight = false;
/** Пока свой notifications WS открыт, опрос /online не должен сбрасывать свой кружок */
let selfOnlineId: string | null = null;
const lastOnlineAt: Record<string, number> = {};
const pendingOffline: Record<string, ReturnType<typeof setTimeout>> = {};

function normId(accountId: string | null | undefined): string {
  return accountId?.trim().toLowerCase() || '';
}

function watchedIds(watchers: Record<string, number>): string[] {
  return Object.entries(watchers)
    .filter(([, n]) => n > 0)
    .map(([id]) => id)
    .slice(0, MAX_BATCH);
}

function clearPendingOffline(id: string) {
  const timer = pendingOffline[id];
  if (timer == null) return;
  clearTimeout(timer);
  delete pendingOffline[id];
}

function ensurePoll(getWatchers: () => Record<string, number>, refresh: () => Promise<void>) {
  const hasWatchers = watchedIds(getWatchers()).length > 0;
  if (hasWatchers && pollTimer == null) {
    pollTimer = setInterval(() => {
      void refresh();
    }, POLL_MS);
  }
  if (!hasWatchers && pollTimer != null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function scheduleRefresh(refresh: () => Promise<void>) {
  if (debounceTimer != null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void refresh();
  }, DEBOUNCE_MS);
}

export const usePresenceStore = create<PresenceState>((set, get) => {
  const applyOnline = (id: string) => {
    lastOnlineAt[id] = Date.now();
    clearPendingOffline(id);
    set(s => (s.onlineById[id] === true ? s : { onlineById: { ...s.onlineById, [id]: true } }));
  };

  const scheduleOffline = (id: string) => {
    if (selfOnlineId === id) return;
    if (pendingOffline[id] != null) return;
    const last = lastOnlineAt[id] ?? 0;
    if (last === 0) {
      set(s => (s.onlineById[id] ? { onlineById: { ...s.onlineById, [id]: false } } : s));
      return;
    }
    const wait = Math.max(0, OFFLINE_GRACE_MS - (Date.now() - last));
    pendingOffline[id] = setTimeout(() => {
      delete pendingOffline[id];
      if (selfOnlineId === id) return;
      set(s => (s.onlineById[id] ? { onlineById: { ...s.onlineById, [id]: false } } : s));
    }, wait);
  };

  return {
    onlineById: {},
    watchers: {},

    watch: (accountId) => {
      const id = normId(accountId);
      if (!id) return;
      set((s) => ({
        watchers: { ...s.watchers, [id]: (s.watchers[id] ?? 0) + 1 },
      }));
      ensurePoll(() => get().watchers, () => get().refresh());
      scheduleRefresh(() => get().refresh());
    },

    unwatch: (accountId) => {
      const id = normId(accountId);
      if (!id) return;
      set((s) => {
        const next = { ...s.watchers };
        const n = (next[id] ?? 0) - 1;
        if (n <= 0) {
          delete next[id];
          clearPendingOffline(id);
        } else {
          next[id] = n;
        }
        return { watchers: next };
      });
      ensurePoll(() => get().watchers, () => get().refresh());
    },

    setSelfOnline: (accountId, online) => {
      const id = normId(accountId);
      if (!id) return;
      if (online) {
        selfOnlineId = id;
        applyOnline(id);
        return;
      }
      if (selfOnlineId === id) selfOnlineId = null;
      scheduleOffline(id);
    },

    refresh: async () => {
      if (refreshInFlight) return;
      // Гость не ходит на /notifications/online (401)
      if (!isAuthenticated()) return;
      const ids = watchedIds(get().watchers);
      if (ids.length === 0) return;
      refreshInFlight = true;
      try {
        const online = await fetchOnlineAccountIds(ids);
        const onlineSet = new Set(online.map(normId));
        for (const id of ids) {
          if (onlineSet.has(id) || selfOnlineId === id) applyOnline(id);
          else scheduleOffline(id);
        }
      } catch {
        /* ignore — оставляем прошлый снимок */
      } finally {
        refreshInFlight = false;
      }
    },
  };
});
