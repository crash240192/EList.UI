// shared/lib/geocode.ts — геокодер через API (Nominatim на бэкенде + MemoryCache)

import {
  getOrCreateClientHash,
  getClientPlatform,
  getAppVersion,
  getAuthToken,
} from '@/shared/api/client';
import type { CommandResult } from '@/shared/api/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/eList';

export interface GeocodedPlace {
  lat: number;
  lng: number;
  address: string;
}

export interface GeocodeSuggestItem {
  lat: number;
  lng: number;
  name: string;
  shortName: string;
}

function geocodeAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'authorization-jwt': getOrCreateClientHash(),
    'X-Client-Platform': getClientPlatform(),
    'X-App-Version': getAppVersion(),
  };
  const token = getAuthToken();
  if (token) headers.Authorization = token;
  return headers;
}

function parsePlace(place: unknown): GeocodedPlace | null {
  if (!place || typeof place !== 'object') return null;
  const p = place as Record<string, unknown>;
  if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return null;
  return {
    lat: p.lat,
    lng: p.lng,
    address: typeof p.address === 'string' ? p.address : '',
  };
}

/**
 * Запрос к /api/geocode*.
 * null — нет данных; undefined — API недоступен.
 */
async function callGeocodeApi<T>(
  path: string,
  map: (raw: unknown) => T | null,
): Promise<T | null | undefined> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers: geocodeAuthHeaders(),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return undefined;
    const data = await res.json() as CommandResult<unknown>;
    if (!data.success) return undefined;
    return map(data.result);
  } catch {
    return undefined;
  }
}

export async function geocodeAddress(query: string): Promise<GeocodedPlace | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const q = encodeURIComponent(trimmed);
  const cached = await callGeocodeApi(
    `/api/geocode?q=${q}&cacheOnly=true`,
    parsePlace,
  );
  if (cached) return cached;

  const fresh = await callGeocodeApi(
    `/api/geocode?q=${q}`,
    parsePlace,
  );
  return fresh ?? null;
}

export async function reverseGeocode(
  lat: number,
  lng: number,
  opts?: { kind?: string },
): Promise<string> {
  const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const kindQs = opts?.kind ? `&kind=${encodeURIComponent(opts.kind)}` : '';
  const base =
    `/api/geocode/reverse?lat=${encodeURIComponent(String(lat))}`
    + `&lng=${encodeURIComponent(String(lng))}${kindQs}`;

  const cached = await callGeocodeApi(base + '&cacheOnly=true', parsePlace);
  if (cached?.address) return cached.address;

  const fresh = await callGeocodeApi(base, parsePlace);
  return fresh?.address || fallback;
}

export async function suggestPlaces(
  query: string,
  limit = 8,
): Promise<GeocodeSuggestItem[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const result = await callGeocodeApi(
    `/api/geocode/suggest?q=${encodeURIComponent(trimmed)}&limit=${limit}`,
    (raw) => {
      if (!Array.isArray(raw)) return [];
      const items: GeocodeSuggestItem[] = [];
      for (const row of raw) {
        if (!row || typeof row !== 'object') continue;
        const r = row as Record<string, unknown>;
        if (typeof r.lat !== 'number' || typeof r.lng !== 'number') continue;
        const name = typeof r.name === 'string' ? r.name : '';
        const shortName = typeof r.shortName === 'string' ? r.shortName : name;
        if (!name && !shortName) continue;
        items.push({ lat: r.lat, lng: r.lng, name: name || shortName, shortName: shortName || name });
      }
      return items;
    },
  );

  return result ?? [];
}
