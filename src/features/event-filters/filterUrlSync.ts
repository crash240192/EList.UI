// features/event-filters/filterUrlSync.ts
// Сериализация состояния поиска главной страницы в query-параметры URL и обратно:
// deep-link, который воспроизводит область карты + все фильтры. Запись — через
// replace (без спама в истории браузера).

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFiltersStore } from '@/app/store';
import { cookies } from '@/shared/lib/cookies';
import type { IEventsSearchParams } from '@/entities/event';

type ViewMode = 'map' | 'list';

interface UrlSyncState {
  filters: IEventsSearchParams;
  viewMode: ViewMode;
  mapCenter: [number, number] | null;
  mapZoom: number;
  searchName: string;
}

/** startTime считаем «выбранной датой» (а не дефолтным «сейчас»), если он
 *  дальше 5 минут от текущего момента либо задан endTime. */
function isDeliberateStart(startTime: string | undefined, endTime: string | undefined): boolean {
  if (!startTime) return false;
  if (endTime) return true;
  const diff = Math.abs(new Date(startTime).getTime() - Date.now());
  return diff > 5 * 60 * 1000;
}

function num(v: string | null): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Собирает query-строку из состояния. Пустые/дефолтные значения опускаются. */
export function encodeFiltersToParams(s: UrlSyncState): URLSearchParams {
  const p = new URLSearchParams();
  const f = s.filters;

  const q = s.searchName.trim();
  if (q) p.set('q', q);

  if (isDeliberateStart(f.startTime, f.endTime) && f.startTime) p.set('from', f.startTime);
  if (f.endTime) p.set('to', f.endTime);
  if (f.price != null) p.set('price', String(f.price));
  if (f.ageLimit != null && f.ageLimit > 0) p.set('age', String(f.ageLimit));
  if (f.types?.length) p.set('types', f.types.join(','));
  if (f.categories?.length) p.set('cats', f.categories.join(','));

  // Область поиска (совпадает с центром карты) + зум
  const lat = f.latitude ?? s.mapCenter?.[0];
  const lng = f.longitude ?? s.mapCenter?.[1];
  if (lat != null && lng != null) {
    p.set('lat', lat.toFixed(5));
    p.set('lng', lng.toFixed(5));
  }
  if (f.locationRange != null) p.set('r', String(Math.round(f.locationRange)));
  if (s.mapZoom) p.set('z', String(s.mapZoom));
  if (s.viewMode === 'list') p.set('view', 'list');

  const city = cookies.get('elist_city_name');
  if (city) p.set('city', city);

  return p;
}

export interface DecodedFilters {
  patch: Partial<IEventsSearchParams>;
  viewMode?: ViewMode;
  mapCenter?: [number, number];
  mapZoom?: number;
  searchName?: string;
  city?: string;
}

/** Разбирает query-параметры в патч состояния. Возвращает null, если
 *  распознаваемых параметров нет (URL чистый — обычный визит). */
export function decodeParamsFromUrl(params: URLSearchParams): DecodedFilters | null {
  const KNOWN = ['q', 'from', 'to', 'price', 'age', 'types', 'cats', 'lat', 'lng', 'r', 'z', 'view', 'city'];
  if (!KNOWN.some((k) => params.has(k))) return null;

  const patch: Partial<IEventsSearchParams> = {};
  const q = params.get('q') ?? '';

  const from = params.get('from');
  if (from) patch.startTime = from;
  const to = params.get('to');
  if (to) patch.endTime = to;

  const price = num(params.get('price'));
  if (price != null) patch.price = price;
  const age = num(params.get('age'));
  if (age != null) patch.ageLimit = age;

  const types = params.get('types');
  if (types) patch.types = types.split(',').filter(Boolean);
  const cats = params.get('cats');
  if (cats) patch.categories = cats.split(',').filter(Boolean);

  const lat = num(params.get('lat'));
  const lng = num(params.get('lng'));
  if (lat != null && lng != null) {
    patch.latitude = lat;
    patch.longitude = lng;
  }
  const r = num(params.get('r'));
  if (r != null) patch.locationRange = r;

  const z = num(params.get('z'));
  const view = params.get('view') === 'list' ? 'list' : undefined;
  const city = params.get('city') ?? undefined;

  return {
    patch,
    viewMode: view,
    mapCenter: lat != null && lng != null ? [lat, lng] : undefined,
    mapZoom: z,
    searchName: q || undefined,
    city,
  };
}

/**
 * Двусторонняя синхронизация главного стора фильтров с URL.
 * — при монтировании: если в URL есть параметры, гидратирует стор из них;
 * — при изменениях: пишет актуальное состояние в URL (replace, debounce).
 */
export function useHomeFilterUrlSync(
  searchName: string,
  setSearchName: (v: string) => void,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useFiltersStore((s) => s.filters);
  const viewMode = useFiltersStore((s) => s.viewMode);
  const mapCenter = useFiltersStore((s) => s.mapCenter);
  const mapZoom = useFiltersStore((s) => s.mapZoom);

  const hydratedRef = useRef(false);
  const lastWrittenRef = useRef<string | null>(null);
  const setSearchParamsRef = useRef(setSearchParams);
  setSearchParamsRef.current = setSearchParams;

  // ── Гидратация из URL (однократно, на маунте) ──
  useEffect(() => {
    hydratedRef.current = true;

    const decoded = decodeParamsFromUrl(searchParams);
    if (!decoded) return;

    const store = useFiltersStore.getState();
    // Применяем патч фильтров целиком, сохраняя pageIndex/pageSize
    useFiltersStore.setState((s) => ({ filters: { ...s.filters, ...decoded.patch } }));
    if (decoded.viewMode) store.setViewMode(decoded.viewMode);
    if (decoded.mapZoom) store.setMapZoom(decoded.mapZoom);
    if (decoded.mapCenter) store.setMapCenter(decoded.mapCenter);
    if (decoded.city) cookies.set('elist_city_name', decoded.city, 30);
    if (decoded.searchName != null) setSearchName(decoded.searchName);

    lastWrittenRef.current = searchParams.toString();
    // Снимок URL берём только на маунте (далее searchParams меняем сами)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Запись в URL при изменениях (debounce, replace) ──
  const encoded = encodeFiltersToParams({ filters, viewMode, mapCenter, mapZoom, searchName }).toString();
  useEffect(() => {
    if (!hydratedRef.current) return;
    const timer = window.setTimeout(() => {
      if (encoded === lastWrittenRef.current) return;
      lastWrittenRef.current = encoded;
      setSearchParamsRef.current(encoded, { replace: true });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [encoded]);
}
