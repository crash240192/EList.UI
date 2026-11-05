/// <reference types="vite/client" />

// MapLibre v6 worker (Vite ?worker&url)
declare module 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url' {
  const url: string;
  export default url;
}

// Типизация переменных окружения Vite (VITE_* переменные)
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_USE_MOCK: string;
  readonly VITE_MAPTILER_KEY?: string;
  readonly VITE_MAPTILER_STYLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
