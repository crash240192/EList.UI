// Runtime-конфиг (Docker entrypoint → /runtime-config.js).
// Локально — fallback на VITE_* из .env.local.

export interface ElistRuntimeConfig {
  mapTilerKey?: string;
  mapTilerStyle?: string;
}

declare global {
  interface Window {
    __ELIST_RUNTIME__?: ElistRuntimeConfig;
  }
}

export function getRuntimeConfig(): ElistRuntimeConfig {
  return typeof window !== 'undefined' ? (window.__ELIST_RUNTIME__ ?? {}) : {};
}

export function getMapTilerKey(): string {
  const fromRuntime = getRuntimeConfig().mapTilerKey?.trim() ?? '';
  if (fromRuntime) return fromRuntime;
  return (import.meta.env.VITE_MAPTILER_KEY as string | undefined)?.trim() ?? '';
}

export function getMapTilerStyle(): string {
  const fromRuntime = getRuntimeConfig().mapTilerStyle?.trim() ?? '';
  if (fromRuntime) return fromRuntime;
  return (import.meta.env.VITE_MAPTILER_STYLE as string | undefined)?.trim() || 'streets-v4';
}
