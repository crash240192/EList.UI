// features/presence/presenceStore.ts — онлайн по notifications WebSocket

import { create } from 'zustand';
import { fetchOnlineAccountIds } from '@/entities/notification/api';

const POLL_MS = 20_000;
const DEBOUNCE_MS = 350;
const MAX_BATCH = 100;

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

function watchedIds(watchers: Record<string, number>): string[] {
  return Object.entries(watchers)
    .filter(([, n]) => n > 0)
    .map(([id]) => id)
    .slice(0, MAX_BATCH);
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

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineById: {},
  watchers: {},

  watch: (accountId) => {
    const id = accountId?.trim();
    if (!id) return;
    set((s) => ({
      watchers: { ...s.watchers, [id]: (s.watchers[id] ?? 0) + 1 },
    }));
    ensurePoll(() => get().watchers, () => get().refresh());
    scheduleRefresh(() => get().refresh());
  },

  unwatch: (accountId) => {
    const id = accountId?.trim();
    if (!id) return;
    set((s) => {
      const next = { ...s.watchers };
      const n = (next[id] ?? 0) - 1;
      if (n <= 0) delete next[id];
      else next[id] = n;
      return { watchers: next };
    });
    ensurePoll(() => get().watchers, () => get().refresh());
  },

  setSelfOnline: (accountId, online) => {
    const id = accountId?.trim();
    if (!id) return;
    set((s) => ({
      onlineById: { ...s.onlineById, [id]: online },
    }));
  },

  refresh: async () => {
    if (refreshInFlight) return;
    const ids = watchedIds(get().watchers);
    if (ids.length === 0) return;
    refreshInFlight = true;
    try {
      const online = await fetchOnlineAccountIds(ids);
      const onlineSet = new Set(online);
      set((s) => {
        const next = { ...s.onlineById };
        for (const id of ids) {
          next[id] = onlineSet.has(id);
        }
        return { onlineById: next };
      });
    } catch {
      /* ignore — оставляем прошлый снимок */
    } finally {
      refreshInFlight = false;
    }
  },
}));
