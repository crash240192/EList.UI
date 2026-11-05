// shared/lib/osmMap.ts — MapLibre GL + MapTiler style.json (OSM raster fallback)

import '@/shared/lib/maplibreWorker';
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  type MapOptions,
  type StyleSpecification,
} from 'maplibre-gl';
import { getMapTilerKey, getMapTilerStyle } from '@/shared/lib/runtimeConfig';

export const DEFAULT_MAP_CENTER: [number, number] = [55.7558, 37.6173];

export type MapTheme = 'light' | 'dark';

const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  // glyphs для подписей кластеров (без MapTiler style.json)
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export function hasMapTilerKey(): boolean {
  return getMapTilerKey().length > 0;
}

/** CSS-invert только для OSM raster fallback в dark. */
export function usesCssMapInvert(theme: MapTheme): boolean {
  return theme === 'dark' && !hasMapTilerKey();
}

export function mapDarkClass(
  theme: MapTheme,
  styles: Record<string, string>,
): string {
  if (theme !== 'dark') return '';
  return hasMapTilerKey() ? (styles.mapDarkNative ?? '') : (styles.mapDarkInvert ?? '');
}

export function mapTilerStyleId(theme: MapTheme): string {
  const base = getMapTilerStyle() || 'streets-v4';
  if (theme === 'dark') {
    if (base.endsWith('-dark')) return base;
    return `${base}-dark`;
  }
  return base.replace(/-dark$/, '');
}

/** Vector style URL MapTiler или inline OSM raster style. */
export function getMapStyle(theme: MapTheme = 'light'): string | StyleSpecification {
  const key = getMapTilerKey();
  if (key) {
    const style = mapTilerStyleId(theme);
    return `https://api.maptiler.com/maps/${style}/style.json?key=${encodeURIComponent(key)}`;
  }
  return OSM_RASTER_STYLE;
}

export interface CreateMapLibreOptions {
  center?: [number, number];
  zoom?: number;
  theme?: MapTheme;
  interactive?: boolean;
  scrollZoom?: boolean;
  attributionControl?: boolean;
}

export function createMap(
  container: HTMLElement,
  options: CreateMapLibreOptions = {},
): MapLibreMap {
  const {
    center = DEFAULT_MAP_CENTER,
    zoom = 12,
    theme = 'light',
    interactive = true,
    scrollZoom = interactive,
    attributionControl = true,
  } = options;

  const map = new MapLibreMap({
    container,
    style: getMapStyle(theme),
    center: [center[1], center[0]], // MapLibre: [lng, lat]
    zoom,
    interactive,
    scrollZoom,
    attributionControl: attributionControl ? undefined : false,
  } satisfies MapOptions);

  if (interactive) {
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
  }

  return map;
}

/** Смена light/dark: setStyle (слои событий нужно вешать заново на styledata). */
export function applyMapTheme(map: MapLibreMap, theme: MapTheme): void {
  map.setStyle(getMapStyle(theme));
}

export function buildOsmPointUrl(lat: number, lng: number, zoom = 16): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}

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

export function createDotMarkerElement(color: string, size = 14): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'elist-map-dot';
  el.style.cssText = `
    width:${size}px;height:${size}px;border-radius:50%;
    background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);
    cursor:grab;
  `;
  return el;
}

export function setPickerBehaviors(map: MapLibreMap, panEnabled: boolean): void {
  if (panEnabled) {
    map.dragPan.enable();
    map.scrollZoom.enable();
    map.touchZoomRotate.enable();
  } else {
    map.dragPan.disable();
    map.scrollZoom.disable();
    map.touchZoomRotate.disable();
  }
  map.doubleClickZoom.disable();
  map.boxZoom.disable();
  map.keyboard.disable();
}

export function disableMapPageScrollCapture(map: MapLibreMap): void {
  map.dragPan.disable();
  map.scrollZoom.disable();
  map.touchZoomRotate.disable();
  map.doubleClickZoom.disable();
  map.boxZoom.disable();
  map.keyboard.disable();
}

export { Marker, Popup, MapLibreMap };
export type { GeoJSONSource, StyleSpecification };
