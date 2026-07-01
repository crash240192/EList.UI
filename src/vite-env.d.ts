/// <reference types="vite/client" />

// Типизация переменных окружения Vite (VITE_* переменные)
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_USE_MOCK: string;
  readonly VITE_YANDEX_MAPS_KEY: string;
  readonly VITE_YANDEX_AD_BLOCK_ID: string;
  readonly VITE_FILE_STORAGE_URL: string;
  /** Пара цветовых схем: default | ocean | sunset */
  readonly VITE_THEME_PACK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
