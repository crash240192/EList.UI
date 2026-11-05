// shared/lib/osmMap.ts — Leaflet + подложка MapTiler (OSM fallback)

import L from 'leaflet';

/** Стиль MapTiler без суффикса темы (streets-v2 → streets-v2 / streets-v2-dark). */
const MAPTILER_STYLE = (import.meta.env.VITE_MAPTILER_STYLE as string | undefined)?.trim() || 'streets-v2';
const MAPTILER_KEY = (import.meta.env.VITE_MAPTILER_KEY as string | undefined)?.trim() || '';

const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

const MAPTILER_ATTRIBUTION =
  '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">&copy; MapTiler</a> '
  + '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">&copy; OpenStreetMap</a>';

export const DEFAULT_MAP_CENTER: [number, number] = [55.7558, 37.6173];

export type MapTheme = 'light' | 'dark';

/**
 * Leaflet 1.9+ по умолчанию рисует флаг Украины в prefix атрибуции.
 * Для продакшена в РФ оставляем нейтральный текст без символики.
 * Атрибуция MapTiler/OSM на тайловом слое сохраняется (лицензия).
 */
const LEAFLET_ATTRIBUTION_PREFIX =
  '<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">Leaflet</a>';

export function createMap(el: HTMLElement, options?: L.MapOptions): L.Map {
  const map = L.map(el, options);
  map.attributionControl?.setPrefix(LEAFLET_ATTRIBUTION_PREFIX);
  return map;
}

export function hasMapTilerKey(): boolean {
  return MAPTILER_KEY.length > 0;
}

/** Нужен CSS-invert только для OSM-fallback (у MapTiler есть свой dark). */
export function usesCssMapInvert(theme: MapTheme): boolean {
  return theme === 'dark' && !hasMapTilerKey();
}

function mapTilerStyleId(theme: MapTheme): string {
  if (theme === 'dark') {
    if (MAPTILER_STYLE.endsWith('-dark')) return MAPTILER_STYLE;
    return `${MAPTILER_STYLE}-dark`;
  }
  return MAPTILER_STYLE.replace(/-dark$/, '');
}

/**
 * Базовый слой: MapTiler (если есть ключ) или классический OSM.
 * MapTiler — 512px тайлы (tileSize + zoomOffset), как в их Leaflet-доках.
 */
export function createBaseTileLayer(theme: MapTheme = 'light'): L.TileLayer {
  if (hasMapTilerKey()) {
    const style = mapTilerStyleId(theme);
    return L.tileLayer(
      `https://api.maptiler.com/maps/${style}/{z}/{x}/{y}.png?key=${encodeURIComponent(MAPTILER_KEY)}`,
      {
        tileSize: 512,
        zoomOffset: -1,
        minZoom: 1,
        maxZoom: 20,
        attribution: MAPTILER_ATTRIBUTION,
        crossOrigin: true,
      },
    );
  }

  return L.tileLayer(OSM_TILE_URL, {
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
  });
}

/** @deprecated используйте createBaseTileLayer */
export function createOsmTileLayer(): L.TileLayer {
  return createBaseTileLayer('light');
}

/** Заменить подложку при смене темы (без пересоздания карты). */
export function replaceBaseTileLayer(
  map: L.Map,
  previous: L.TileLayer | null | undefined,
  theme: MapTheme,
): L.TileLayer {
  if (previous) {
    map.removeLayer(previous);
  }
  const next = createBaseTileLayer(theme);
  next.addTo(map);
  next.bringToBack();
  return next;
}

/** Ссылка на точку в OSM */
export function buildOsmPointUrl(lat: number, lng: number, zoom = 16): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}

/** Расстояние между двумя точками (метры), формула гаверсинуса */
export function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function createDotIcon(color: string, size = 14): L.DivIcon {
  return L.divIcon({
    className: 'elist-map-dot',
    html: `<span style="
      display:block;width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);
    "></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Компактный зум Leaflet справа сверху */
export function addCompactZoomControl(map: L.Map): void {
  L.control.zoom({ position: 'topright' }).addTo(map);
}

export function setPickerBehaviors(map: L.Map, panEnabled: boolean): void {
  map.doubleClickZoom.disable();
  map.boxZoom.disable();
  map.keyboard.disable();
  if (panEnabled) {
    map.dragging.enable();
    map.scrollWheelZoom.enable();
    map.touchZoom.enable();
  } else {
    map.dragging.disable();
    map.scrollWheelZoom.disable();
    map.touchZoom.disable();
  }
}

export function disableMapPageScrollCapture(map: L.Map): void {
  map.dragging.disable();
  map.scrollWheelZoom.disable();
  map.touchZoom.disable();
  map.doubleClickZoom.disable();
  map.boxZoom.disable();
  map.keyboard.disable();
}
