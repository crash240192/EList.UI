// app/store/index.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  isAuthenticated as clientIsAuthenticated,
} from '@/shared/api/client';
import { getActivationRequired, setActivationRequired, logout as apiLogout } from '@/features/auth/api';

// ---- Theme Store ----

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      toggleTheme: () =>
        set((s) => {
          const next = s.theme === 'dark' ? 'light' : 'dark';
          document.body.classList.toggle('light-theme', next === 'light');
          return { theme: next };
        }),
      setTheme: (theme) => {
        document.body.classList.toggle('light-theme', theme === 'light');
        set({ theme });
      },
    }),
    { name: 'elist-theme' }
  )
);

// ---- Favorites Store ----

interface FavoritesState {
  favoriteIds: Set<string>;
  toggle: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favoriteIds: new Set<string>(),
      toggle: (id) =>
        set((s) => {
          const next = new Set(s.favoriteIds);
          next.has(id) ? next.delete(id) : next.add(id);
          return { favoriteIds: next };
        }),
      isFavorite: (id) => get().favoriteIds.has(id),
    }),
    {
      name: 'elist-favorites',
      serialize: (state) =>
        JSON.stringify({ ...state, state: { ...state.state, favoriteIds: [...state.state.favoriteIds] } }),
      deserialize: (str) => {
        const parsed = JSON.parse(str);
        parsed.state.favoriteIds = new Set(parsed.state.favoriteIds);
        return parsed;
      },
    }
  )
);

// ---- Auth Store ----

interface AuthState {
  token: string | null;
  accountId: string | null;
  activationRequired: boolean;
  setAuth: (token: string, activationRequired: boolean, accountId?: string) => void;
  confirmActivation: () => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  needsActivation: () => boolean;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  token:              getAuthToken(),
  accountId:          null,
  activationRequired: getActivationRequired(),

  setAuth: (token, activationRequired, accountId) => {
    setAuthToken(token);
    setActivationRequired(activationRequired);
    set({ token, activationRequired, accountId: accountId ?? null });
  },

  confirmActivation: () => {
    setActivationRequired(false);
    set({ activationRequired: false });
  },

  logout: () => {
    apiLogout();
    set({ token: null, accountId: null, activationRequired: false });
  },

  isAuthenticated:  () => clientIsAuthenticated(),
  needsActivation:  () => !!get().activationRequired,
  hydrate:          () => set({ token: getAuthToken(), activationRequired: getActivationRequired() }),
}));

// ---- Filters Store ----

import type { IEventsSearchParams } from '@/entities/event';

interface FiltersState {
  filters: IEventsSearchParams;
  setFilter: <K extends keyof IEventsSearchParams>(key: K, value: IEventsSearchParams[K]) => void;
  resetFilters: () => void;
}

const DEFAULT_FILTERS: IEventsSearchParams = {
  pageIndex: 0,
  pageSize: 20,
  startTime: new Date().toISOString(),
};

export const useFiltersStore = create<FiltersState>()((set) => ({
  filters:      DEFAULT_FILTERS,
  setFilter:    (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
}));
