// shared/lib/osmMap.ts — Leaflet + тайлы OpenStreetMap

import L from 'leaflet';

export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

export const DEFAULT_MAP_CENTER: [number, number] = [55.7558, 37.6173];

/**
 * Leaflet 1.9+ по умолчанию рисует флаг Украины в prefix атрибуции.
 * Оставляем нейтральный текст; атрибуция OSM на тайловом слое сохраняется.
 */
const LEAFLET_ATTRIBUTION_PREFIX =
  '<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">Leaflet</a>';

export function createMap(el: HTMLElement, options?: L.MapOptions): L.Map {
  const map = L.map(el, options);
  map.attributionControl?.setPrefix(LEAFLET_ATTRIBUTION_PREFIX);
  return map;
}

export function createOsmTileLayer(): L.TileLayer {
  return L.tileLayer(OSM_TILE_URL, {
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
    // DPR≥2 (мобилки): иначе 256px-тайл растягивается → мыло/пиксели.
    // Leaflet берёт z+1 и рисует в половинном CSS-size; maxZoom станет 18
    // (zoomOffset+1 → нативный OSM z19 на крайнем зуме, без запроса z20).
    detectRetina: true,
  });
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
