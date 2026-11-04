// shared/lib/yandexMaps.ts
// Яндекс.Карты API 2.1 (стабильный, работает с ключом "JavaScript API")

import {
  getOrCreateClientHash,
  getClientPlatform,
  getAppVersion,
  getAuthToken,
} from '@/shared/api/client';
import type { CommandResult } from '@/shared/api/types';

const YMAPS_API_KEY = import.meta.env.VITE_YANDEX_MAPS_KEY ?? '';
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/eList';

let loadPromise: Promise<void> | null = null;

export function loadYandexMaps(): Promise<void> {
  if (loadPromise) return loadPromise;
  if ((window as any).ymaps?.ready && (window as any).ymaps._loaded) return Promise.resolve();

  if (!YMAPS_API_KEY) {
    return Promise.reject(new Error('VITE_YANDEX_MAPS_KEY не задан в .env.local'));
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    // API 2.1 — стабильная версия, работает с ключом "JavaScript API"
    script.src   = `https://api-maps.yandex.ru/2.1/?apikey=${YMAPS_API_KEY}&lang=ru_RU&load=package.full`;
    script.async = true;

    const timer = setTimeout(() => {
      loadPromise = null;
      reject(new Error('Таймаут загрузки Яндекс.Карт'));
    }, 15_000);

    script.onload = () => {
      clearTimeout(timer);
      const ymaps = (window as any).ymaps;
      if (!ymaps?.ready) {
        loadPromise = null;
        reject(new Error('ymaps не найден после загрузки'));
        return;
      }
      ymaps.ready(() => {
        ymaps._loaded = true;
        console.log('[YMaps] 2.1 успешно загружены');
        resolve();
      });
    };

    script.onerror = () => {
      clearTimeout(timer);
      loadPromise = null;
      reject(new Error(
        `Не удалось загрузить Яндекс.Карты. ` +
        `Ключ: ${YMAPS_API_KEY.slice(0, 8)}... — ` +
        `убедитесь что в настройках ключа активирован сервис "JavaScript API"`
      ));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

/** Клик по POI на подложке не перехватывает размещение точки */
export const YMAP_DISABLE_POI_OPTIONS = {
  yandexMapDisablePoiInteractivity: true,
  suppressMapOpenBlock: true,
};

/** Компактные кнопки +/- вверху — на низких контейнерах не обрезаются снизу */
export const YMAP_ZOOM_CONTROL_LAYOUT = {
  float: 'none',
  position: { top: 8, right: 8 },
  size: 'small',
} as const;

export function addCompactZoomControl(map: { controls: { add: (name: string, opts: object) => void } }): void {
  map.controls.add('zoomControl', YMAP_ZOOM_CONTROL_LAYOUT);
}

/** Не перехватывать колесо мыши и свайпы — прокрутка идёт по странице */
export function disableMapPageScrollCapture(map: {
  behaviors: { disable: (name: string) => void };
}): void {
  ['scrollZoom', 'drag', 'multiTouch', 'dblClickZoom', 'rightMouseButtonMagnifier'].forEach(b => {
    map.behaviors.disable(b);
  });
}

/** Выбор точки: клик и маркер, без зума колёсиком и сдвига карты */
export function configurePickerMapBehaviors(map: {
  behaviors: { disable: (name: string) => void };
}): void {
  ['scrollZoom', 'multiTouch', 'drag', 'dblClickZoom', 'rightMouseButtonMagnifier'].forEach(b => {
    map.behaviors.disable(b);
  });
}

/** Развёрнутая карта: сдвиг, зум колёсиком/жестами, клик — выбор точки */
export function configureExpandedPickerMapBehaviors(map: {
  behaviors: { disable: (name: string) => void };
}): void {
  ['dblClickZoom', 'rightMouseButtonMagnifier'].forEach(b => {
    map.behaviors.disable(b);
  });
}

/** Ссылка «Открыть в Яндекс Картах» с меткой в указанной точке (pt = lon,lat) */
export function buildYandexMapsPointUrl(lat: number, lng: number, zoom = 16): string {
  return `https://yandex.ru/maps/?pt=${lng},${lat}&z=${zoom}&l=map`;
}

const YANDEX_MAPS_LINK_SELECTOR = 'a[href*="yandex.ru/maps"], a[href*="yandex.com/maps"]';

/** Блоки API с собственной ссылкой (маршрут, «открыть в картах») — не трогаем */
function isYmapsPromoLink(el: Element, root: HTMLElement): boolean {
  let node: Element | null = el;
  while (node && node !== root) {
    const cls = typeof node.className === 'string' ? node.className : '';
    if (
      cls.includes('promo')
      || cls.includes('gotoymaps')
      || cls.includes('open-block')
      || cls.includes('route')
    ) return true;
    node = node.parentElement;
  }
  return false;
}

/**
 * Подменяет href у копирайт-ссылки «Яндекс Карты» (правый нижний угол),
 * чтобы открывалась карта с меткой в точке мероприятия.
 */
export function attachYandexCopyrightPointLink(
  container: HTMLElement,
  lat: number,
  lng: number,
  zoom: number,
): () => void {
  const url = buildYandexMapsPointUrl(lat, lng, zoom);

  const patch = () => {
    container.querySelectorAll(YANDEX_MAPS_LINK_SELECTOR).forEach(el => {
      if (!(el instanceof HTMLAnchorElement)) return;
      if (isYmapsPromoLink(el, container)) return;
      if (el.href === url) return;
      el.href = url;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
    });
  };

  patch();
  const observer = new MutationObserver(patch);
  observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  return () => observer.disconnect();
}

export interface GeocodedPlace { lat: number; lng: number; address: string; }

function parseGeocodedPlace(member: any, fallbackAddress: string): GeocodedPlace | null {
  const pos = member?.Point?.pos?.split(' '); // "lng lat"
  if (!pos || pos.length < 2) return null;
  return {
    lng: parseFloat(pos[0]),
    lat: parseFloat(pos[1]),
    address: member.metaDataProperty?.GeocoderMetaData?.text ?? fallbackAddress,
  };
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

/**
 * Тихий peek серверного MemoryCache (cacheOnly=true).
 * null — промах / нет данных; undefined — API недоступен (не считаем промахом кэша).
 */
async function peekApiGeocode(
  path: string,
): Promise<GeocodedPlace | null | undefined> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers: geocodeAuthHeaders(),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return undefined;
    const data = await res.json() as CommandResult<GeocodedPlace | null>;
    if (!data.success) return undefined;
    const place = data.result;
    if (place && typeof place.lat === 'number' && typeof place.lng === 'number') {
      return {
        lat: place.lat,
        lng: place.lng,
        address: place.address ?? '',
      };
    }
    return null;
  } catch {
    return undefined;
  }
}

/** Fire-and-forget: положить клиентский ответ Яндекса в API-кэш. */
function warmApiGeocodeCache(body: Record<string, unknown>): void {
  void fetch(`${API_BASE}/api/geocode/cache`, {
    method: 'POST',
    headers: geocodeAuthHeaders(),
    body: JSON.stringify(body),
  }).catch(() => {});
}

export async function geocodeAddress(query: string): Promise<GeocodedPlace | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const apiHit = await peekApiGeocode(
    `/api/geocode?q=${encodeURIComponent(trimmed)}&cacheOnly=true`,
  );
  if (apiHit) return apiHit;

  if (!YMAPS_API_KEY) return null;

  try {
    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${YMAPS_API_KEY}`
      + `&geocode=${encodeURIComponent(trimmed)}&format=json&results=1&lang=ru_RU`;
    const res  = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const member = json?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
    if (!member) return null;
    const place = parseGeocodedPlace(member, trimmed);
    if (place) {
      warmApiGeocodeCache({ query: trimmed, place });
    }
    return place;
  } catch { return null; }
}

export async function reverseGeocode(
  lat: number,
  lng: number,
  opts?: { kind?: string },
): Promise<string> {
  const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  const kindQs = opts?.kind ? `&kind=${encodeURIComponent(opts.kind)}` : '';
  const apiHit = await peekApiGeocode(
    `/api/geocode/reverse?lat=${encodeURIComponent(String(lat))}`
      + `&lng=${encodeURIComponent(String(lng))}${kindQs}&cacheOnly=true`,
  );
  if (apiHit?.address) return apiHit.address;

  if (!YMAPS_API_KEY) return fallback;

  try {
    let url = `https://geocode-maps.yandex.ru/1.x/?apikey=${YMAPS_API_KEY}`
      + `&geocode=${lng},${lat}&format=json&results=1&lang=ru_RU`;
    if (opts?.kind) url += `&kind=${encodeURIComponent(opts.kind)}`;
    const res  = await fetch(url);
    if (!res.ok) return fallback;
    const json = await res.json();
    const member = json?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
    const text = member?.metaDataProperty?.GeocoderMetaData?.text ?? fallback;
    if (text && text !== fallback) {
      warmApiGeocodeCache({
        lat,
        lng,
        kind: opts?.kind,
        place: { lat, lng, address: text },
      });
    }
    return text;
  } catch { return fallback; }
}
