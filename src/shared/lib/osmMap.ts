// shared/lib/osmMap.ts — MapLibre GL + OpenFreeMap (данные OSM, без API-ключа)

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

export const DEFAULT_MAP_CENTER: [number, number] = [55.7558, 37.6173];

export type MapTheme = 'light' | 'dark';

/**
 * Публичные стили OpenFreeMap (коммерческое OK, без ключа).
 * style.json не в репо — грузится по URL (MapLibre Style Spec).
 *
 * light: liberty (с building-3d — оставляем, pitch=0).
 * dark:  fiord, не stock «dark» (тот почти чёрный); fiord читаемее.
 */
export const OPENFREEMAP_STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty';
export const OPENFREEMAP_STYLE_DARK = 'https://tiles.openfreemap.org/styles/fiord';

/** Палитра тёмной темы карты — токены UI (`index.css` / hero). */
export const ELIST_DARK_MAP_PALETTE = {
  background: '#f0f1f7', // --text-primary (светлый холст)
  water: '#1a1040', // hero gradient start
  residential: '#272932', // --surface-2
  building: '#32343f', // --border
  streetMaj: '#CA54F9',
  streetMin: '#4f46e5', // --accent-hover
} as const;

const mapThemeByInstance = new WeakMap<MapLibreMap, MapTheme>();

export function getMapStyle(theme: MapTheme = 'light'): string {
  return theme === 'dark' ? OPENFREEMAP_STYLE_DARK : OPENFREEMAP_STYLE_LIGHT;
}

/** OFM dark — нативный стиль, CSS-invert не нужен. */
export function mapDarkClass(
  theme: MapTheme,
  styles: Record<string, string>,
): string {
  if (theme !== 'dark') return '';
  return styles.mapDarkNative ?? '';
}

function setPaintSafe(
  map: MapLibreMap,
  layerId: string,
  prop: string,
  value: unknown,
): void {
  if (!map.getLayer(layerId)) return;
  try {
    // prop зависит от типа слоя; вызываем только для известных id
    map.setPaintProperty(layerId, prop as never, value as never);
  } catch {
    /* слой есть, но paint-ключ другой — пропускаем */
  }
}

/**
 * Перекраска fiord под палитру приложения.
 * Фон светлый (#f0f1f7) — подписи суши затемняем для читаемости.
 */
function applyElistDarkPalette(map: MapLibreMap): void {
  if (!map.isStyleLoaded()) return;
  const p = ELIST_DARK_MAP_PALETTE;

  setPaintSafe(map, 'background', 'background-color', p.background);
  setPaintSafe(map, 'water', 'fill-color', p.water);
  setPaintSafe(map, 'waterway', 'line-color', p.water);
  setPaintSafe(map, 'landuse_residential', 'fill-color', p.residential);
  setPaintSafe(map, 'road_area_pier', 'fill-color', p.background);
  setPaintSafe(map, 'road_pier', 'line-color', p.streetMin);

  setPaintSafe(map, 'building', 'fill-color', p.building);
  setPaintSafe(map, 'building-3d', 'fill-extrusion-color', p.building);

  const maj = [
    'highway_major_inner',
    'highway_major_subtle',
    'highway_major_casing',
    'highway_motorway_inner',
    'highway_motorway_subtle',
    'highway_motorway_casing',
    'tunnel_motorway_casing',
    'tunnel_motorway_inner',
  ];
  for (const id of maj) setPaintSafe(map, id, 'line-color', p.streetMaj);

  const min = [
    'highway_minor',
    'highway_path',
    'aeroway-taxiway',
    'aeroway-runway-casing',
    'aeroway-runway',
  ];
  for (const id of min) setPaintSafe(map, id, 'line-color', p.streetMin);
  setPaintSafe(map, 'aeroway-area', 'fill-color', p.streetMin);

  // подписи: светлый холст → тёмный текст; вода → светлый
  const landText = '#1a1f2e';
  const landHalo = 'rgba(240, 241, 247, 0.85)';
  for (const id of [
    'highway_name_other',
    'highway_ref',
    'place_other',
    'place_suburb',
    'place_village',
    'place_town',
    'place_city',
    'place_city_large',
    'place_state',
    'place_country_other',
    'place_country_minor',
    'place_country_major',
    'place_continent',
  ]) {
    setPaintSafe(map, id, 'text-color', landText);
    setPaintSafe(map, id, 'text-halo-color', landHalo);
  }
  setPaintSafe(map, 'water_name', 'text-color', '#f0f1f7');
  setPaintSafe(map, 'water_name', 'text-halo-color', 'rgba(26, 16, 64, 0.75)');
}

/**
 * Fiord (dark) по умолчанию без building-3d — добавляем как у liberty,
 * цвет берём из плоского слоя building (после палитры — --border).
 */
function ensureBuilding3d(map: MapLibreMap): void {
  if (!map.isStyleLoaded() || map.getLayer('building-3d')) return;
  if (!map.getSource('openmaptiles')) return;

  let color: string | unknown = ELIST_DARK_MAP_PALETTE.building;
  try {
    if (map.getLayer('building')) {
      color = map.getPaintProperty('building', 'fill-color') ?? color;
    }
  } catch {
    /* нет слоя */
  }

  map.addLayer({
    id: 'building-3d',
    type: 'fill-extrusion',
    source: 'openmaptiles',
    'source-layer': 'building',
    minzoom: 14,
    filter: ['!', ['has', 'hide_3d']],
    paint: {
      'fill-extrusion-base': ['get', 'render_min_height'],
      'fill-extrusion-color': color as string,
      'fill-extrusion-height': ['get', 'render_height'],
      'fill-extrusion-opacity': 0.85,
    },
  });

  // как liberty: плоский fill до z14, дальше extrusion
  if (map.getLayer('building')) {
    try {
      map.setLayerZoomRange('building', 12, 14);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Не даём уйти в сильный наклон (главный GPU-риск на мобилке).
 * 3D-здания — и в light (liberty), и в dark (fiord + наш слой).
 * Тёмная тема: поверх fiord — ELIST_DARK_MAP_PALETTE.
 */
export function flattenMapView(map: MapLibreMap): void {
  map.setPitch(0);
  map.setBearing(0);
  const theme = mapThemeByInstance.get(map) ?? 'light';
  if (theme === 'dark') applyElistDarkPalette(map);
  ensureBuilding3d(map);
  if (theme === 'dark') {
    // building-3d мог появиться после первой перекраски
    setPaintSafe(map, 'building-3d', 'fill-extrusion-color', ELIST_DARK_MAP_PALETTE.building);
  }
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
    // здания 3D ок; жесткий pitch/rotate на мобилке режем (дороже GPU)
    pitch: 0,
    maxPitch: 0,
    dragRotate: false,
    touchPitch: false,
    pitchWithRotate: false,
  } satisfies MapOptions);

  mapThemeByInstance.set(map, theme);

  const onStyle = () => flattenMapView(map);
  map.on('load', onStyle);
  map.on('style.load', onStyle);

  if (interactive) {
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
  }

  return map;
}

/** Смена light/dark: setStyle (слои событий перевешиваются на style.load). */
export function applyMapTheme(map: MapLibreMap, theme: MapTheme): void {
  mapThemeByInstance.set(map, theme);
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
