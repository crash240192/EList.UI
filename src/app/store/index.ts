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

// ---- Toast Store ----

export interface ToastItem { id: number; message: string; type: 'error' | 'success' | 'info'; }

interface ToastState {
  toasts: ToastItem[];
  add: (message: string, type?: ToastItem['type']) => void;
  remove: (id: number) => void;
}

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  add: (message, type = 'error') => {
    if (get().toasts.some(t => t.message === message)) return;
    const id = Date.now();
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 5000);
  },
  remove: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

// ---- Filters Store ----

import type { IEventsSearchParams } from '@/entities/event';

interface FiltersState {
  filters: IEventsSearchParams;
  setFilter: <K extends keyof IEventsSearchParams>(key: K, value: IEventsSearchParams[K]) => void;
  resetFilters: () => void;
  viewMode: 'map' | 'list';
  setViewMode: (v: 'map' | 'list') => void;
  mapCenter: [number, number] | null;
  setMapCenter: (c: [number, number] | null) => void;
  mapZoom: number;
  setMapZoom: (z: number) => void;
}

const DEFAULT_FILTERS: IEventsSearchParams = {
  pageIndex: 0,
  pageSize: 20,
  startTime: new Date().toISOString(),
};

// Стор фильтров для главной страницы поиска
export const useFiltersStore = create<FiltersState>()((set) => ({
  filters:      DEFAULT_FILTERS,
  setFilter:    (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
  viewMode:     'map',
  setViewMode:  (v) => set({ viewMode: v }),
  mapCenter:    null,
  setMapCenter: (c) => set({ mapCenter: c }),
  mapZoom:      12,
  setMapZoom:   (z) => set({ mapZoom: z }),
}));

// Стор фильтров для страницы "Мои мероприятия" — независимый от главной
export const useMyEventsFiltersStore = create<FiltersState>()((set) => ({
  filters:      { pageIndex: 0, pageSize: 20 },
  setFilter:    (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () => set({ filters: { pageIndex: 0, pageSize: 20 } }),
  viewMode:     'list',
  setViewMode:  (v) => set({ viewMode: v }),
  mapCenter:    null,
  setMapCenter: (c) => set({ mapCenter: c }),
  mapZoom:      12,
  setMapZoom:   (z) => set({ mapZoom: z }),
}));
