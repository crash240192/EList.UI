# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite, localhost:5173)
npm run build     # Type-check + build (tsc && vite build)
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

No test framework is configured.

## Environment

Copy `.env.example` to `.env.local` and fill in:
- `VITE_API_BASE_URL` — main backend
- `VITE_USE_MOCK` — enable mock data
- `VITE_YANDEX_MAPS_KEY` — Yandex Maps API key
- `VITE_YANDEX_AD_BLOCK_ID` — Yandex ad unit
- `VITE_FILE_STORAGE_URL` — file storage service

The Vite dev server proxies three backends:
- `/eList` → main API (`92.118.113.6:35028`)
- `/elist/filestorage` → file storage (`92.118.113.6:35029`)
- `/yandex-maps-api` → Yandex Maps (CORS bypass)

## Architecture

**EList** is a Russian-language event discovery platform (search, create, map-based browsing). It follows **Feature-Sliced Design (FSD)**:

```
src/
├── app/         # Router, AppLayout, Zustand stores
├── pages/       # Full-page views (lazy-loaded)
├── features/    # Feature-specific logic (auth, filters, event-list, map, subscriptions)
├── entities/    # Domain types + API + UI per entity (event, user, invitation, media, admin)
└── shared/      # HTTP client, hooks, reusable UI components, utilities
```

### State (Zustand — `app/store/index.ts`)

| Store | Purpose | Persisted |
|---|---|---|
| `useAuthStore` | JWT token, accountId, activation flag | Cookie |
| `useThemeStore` | dark/light theme | Yes |
| `useFavoritesStore` | favorite event IDs (Set) | Yes |
| `useFiltersStore` | home page event search filters | No |
| `useMyEventsFiltersStore` | my-events page filters | No |

### API Layer (`shared/api/client.ts`)

- Thin fetch wrapper: `apiClient.get/post/put/delete`
- Auth: `authorization-jwt` header (not `Bearer`)
- Auto-redirects to `/login` on 401
- 30s timeout, `ApiError` class for errors
- Response shape: `CommandResult<T>` (single) / `PagedList<T>` (paginated)
- Each entity has its own `entities/{entity}/api.ts` with typed functions

### Routing (`app/router/index.tsx`)

- All pages are `React.lazy()` + `Suspense` with a custom loader
- Protected routes wrapped in `AppLayout` (header, sidebar, nav)
- Public routes (`/login`, `/register`, `/activate`) bypass layout via `AuthGuard`

### Styling

- CSS Modules only — every component has a `.module.css` sibling
- Theme toggled via `light-theme` class on `<body>` (dark is default)
- Custom SVG icons inline — no icon library

### Maps

Yandex Maps is integrated via `shared/lib/yandex-maps.ts`. The API key comes from `VITE_YANDEX_MAPS_KEY`. The proxy at `/yandex-maps-api` avoids CORS issues in dev.
