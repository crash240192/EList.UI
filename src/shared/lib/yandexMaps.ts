// shared/lib/yandexMaps.ts
// Яндекс.Карты API 2.1 (стабильный, работает с ключом "JavaScript API")

const YMAPS_API_KEY = import.meta.env.VITE_YANDEX_MAPS_KEY ?? '';

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

/** Клиентский кэш геокодера: память + localStorage, TTL 24ч (пока нет бэкенд-кэша). */
const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const GEO_CACHE_STORAGE_KEY = 'elist:geocode-cache:v1';
const GEO_CACHE_MAX_ENTRIES = 200;

type GeoCacheEntry = { value: string; exp: number };

const geoMemoryCache = new Map<string, GeoCacheEntry>();
let geoStorageHydrated = false;

function hydrateGeoStorage(): void {
  if (geoStorageHydrated || typeof localStorage === 'undefined') return;
  geoStorageHydrated = true;
  try {
    const raw = localStorage.getItem(GEO_CACHE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, GeoCacheEntry>;
    const now = Date.now();
    for (const [k, v] of Object.entries(parsed)) {
      if (v?.value != null && typeof v.exp === 'number' && v.exp > now) {
        geoMemoryCache.set(k, v);
      }
    }
  } catch { /* ignore corrupt cache */ }
}

function persistGeoStorage(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const now = Date.now();
    for (const [k, v] of geoMemoryCache) {
      if (v.exp <= now) geoMemoryCache.delete(k);
    }
    while (geoMemoryCache.size > GEO_CACHE_MAX_ENTRIES) {
      const oldest = geoMemoryCache.keys().next().value;
      if (oldest == null) break;
      geoMemoryCache.delete(oldest);
    }
    const obj: Record<string, GeoCacheEntry> = {};
    for (const [k, v] of geoMemoryCache) obj[k] = v;
    localStorage.setItem(GEO_CACHE_STORAGE_KEY, JSON.stringify(obj));
  } catch { /* quota / private mode */ }
}

function readGeoCache(key: string): string | null {
  hydrateGeoStorage();
  const hit = geoMemoryCache.get(key);
  if (!hit) return null;
  if (hit.exp <= Date.now()) {
    geoMemoryCache.delete(key);
    return null;
  }
  return hit.value;
}

function writeGeoCache(key: string, value: string): void {
  hydrateGeoStorage();
  geoMemoryCache.set(key, { value, exp: Date.now() + GEO_CACHE_TTL_MS });
  persistGeoStorage();
}

function normalizeGeocodeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

/** Округление ~11 м — повышает попадание в кэш при мелких сдвигах маркера */
function reverseCacheKey(lat: number, lng: number, kind?: string): string {
  const suffix = kind ? `:${kind}` : '';
  return `rev:${lat.toFixed(4)},${lng.toFixed(4)}${suffix}`;
}

function parseGeocodedPlace(member: any, fallbackAddress: string): GeocodedPlace | null {
  const pos = member?.Point?.pos?.split(' '); // "lng lat"
  if (!pos || pos.length < 2) return null;
  return {
    lng: parseFloat(pos[0]),
    lat: parseFloat(pos[1]),
    address: member.metaDataProperty?.GeocoderMetaData?.text ?? fallbackAddress,
  };
}

export async function geocodeAddress(query: string): Promise<GeocodedPlace | null> {
  const trimmed = query.trim();
  if (!trimmed || !YMAPS_API_KEY) return null;

  const cacheKey = `fwd:${normalizeGeocodeQuery(trimmed)}`;
  const cached = readGeoCache(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as GeocodedPlace;
      if (parsed?.lat != null && parsed?.lng != null) return parsed;
    } catch { /* fall through */ }
  }

  try {
    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${YMAPS_API_KEY}`
      + `&geocode=${encodeURIComponent(trimmed)}&format=json&results=1&lang=ru_RU`;
    const res  = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const member = json?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
    if (!member) return null;
    const place = parseGeocodedPlace(member, trimmed);
    if (place) writeGeoCache(cacheKey, JSON.stringify(place));
    return place;
  } catch { return null; }
}

export async function reverseGeocode(
  lat: number,
  lng: number,
  opts?: { kind?: string },
): Promise<string> {
  const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  if (!YMAPS_API_KEY) return fallback;

  const cacheKey = reverseCacheKey(lat, lng, opts?.kind);
  const cached = readGeoCache(cacheKey);
  if (cached) return cached;

  try {
    let url = `https://geocode-maps.yandex.ru/1.x/?apikey=${YMAPS_API_KEY}`
      + `&geocode=${lng},${lat}&format=json&results=1&lang=ru_RU`;
    if (opts?.kind) url += `&kind=${encodeURIComponent(opts.kind)}`;
    const res  = await fetch(url);
    if (!res.ok) return fallback;
    const json = await res.json();
    const member = json?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
    const text = member?.metaDataProperty?.GeocoderMetaData?.text ?? fallback;
    writeGeoCache(cacheKey, text);
    return text;
  } catch { return fallback; }
}
