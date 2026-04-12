/// <reference types="vite/client" />

// Типизация переменных окружения Vite (VITE_* переменные)
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_USE_MOCK: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
