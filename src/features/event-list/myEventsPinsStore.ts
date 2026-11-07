// Локальный порядок закрепов «Моих событий». Бэкенд pin не умеет:
// храним id (последний закреплённый — первый) и снимок события,
// чтобы закреп оставался сверху, пока его страница ещё не загружена.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IEvent } from '@/entities/event';

interface AccountPins {
  ids: string[];
  snapshots: Record<string, IEvent>;
}

interface MyEventsPinsState {
  byAccount: Record<string, AccountPins>;
  pin: (accountId: string, event: IEvent) => void;
  unpin: (accountId: string, id: string) => void;
  remember: (accountId: string, event: IEvent) => void;
}

function accountPins(state: MyEventsPinsState, accountId: string): AccountPins {
  return state.byAccount[accountId] ?? { ids: [], snapshots: {} };
}

export const useMyEventsPinsStore = create<MyEventsPinsState>()(
  persist(
    (set) => ({
      byAccount: {},

      pin: (accountId, event) => set((s) => {
        const cur = accountPins(s, accountId);
        return {
          byAccount: {
            ...s.byAccount,
            [accountId]: {
              ids: [event.id, ...cur.ids.filter((id) => id !== event.id)],
              snapshots: { ...cur.snapshots, [event.id]: event },
            },
          },
        };
      }),

      unpin: (accountId, id) => set((s) => {
        const cur = s.byAccount[accountId];
        if (!cur?.ids.includes(id)) return s;
        const snapshots = { ...cur.snapshots };
        delete snapshots[id];
        return {
          byAccount: {
            ...s.byAccount,
            [accountId]: {
              ids: cur.ids.filter((item) => item !== id),
              snapshots,
            },
          },
        };
      }),

      remember: (accountId, event) => set((s) => {
        const cur = s.byAccount[accountId];
        if (!cur?.ids.includes(event.id) || cur.snapshots[event.id] === event) return s;
        return {
          byAccount: {
            ...s.byAccount,
            [accountId]: {
              ...cur,
              snapshots: { ...cur.snapshots, [event.id]: event },
            },
          },
        };
      }),
    }),
    { name: 'elist-my-events-pins' },
  ),
);
