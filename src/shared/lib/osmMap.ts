// shared/lib/osmMap.ts — MapLibre GL + OpenFreeMap (данные OSM, без API-ключа)

import '@/shared/lib/maplibreWorker';
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  type FilterSpecification,
  type GeoJSONSource,
  type LayerSpecification,
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
 * dark:  fiord → ELIST_DARK_MAP_PALETTE (запекаем в StyleSpecification).
 */
export const OPENFREEMAP_STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty';
export const OPENFREEMAP_STYLE_DARK = 'https://tiles.openfreemap.org/styles/fiord';

/** Палитра тёмной темы карты — токены UI (`index.css` / hero). */
export const ELIST_DARK_MAP_PALETTE = {
  background: '#16171e', // --bg
  water: '#1a1040', // hero gradient start
  residential: '#272932', // --surface-2
  park: '#0d2818', // hero gradient end (леса / парки)
  building: '#343646', // --border
  streetMaj: '#793f94',
  streetMin: '#3d6386',
} as const;

/**
 * Тюнинг neon-glow улиц (тёмная карта).
 * Крути коэффициенты здесь — эталонные zoom-stop’ы в injectStreetGlow трогать не нужно.
 * `opacity: 1` = эталон «сильного» glow; `0.5` = вдвое тише.
 */
export const ELIST_STREET_GLOW = {
  /** Прозрачность / «яркость» свечения (множитель к stop opacity) */
  opacity: 0.5,
  /** Толщина glow-underlay (множитель к stop width) */
  width: 1,
  /** Размытие краёв (множитель к stop blur) */
  blur: 1,
  /** Внешний bloom-слой (широкое свечение); false = только плотный inner */
  outerEnabled: true,
  /** Цвет glow второстепенных улиц (чуть ярче ядра) */
  colorMin: '#6a9fc8',
  /** Цвет glow магистралей */
  colorMaj: '#c47ae8',
} as const;

const mapThemeByInstance = new WeakMap<MapLibreMap, MapTheme>();

/** Pending dark style — один fetch на вкладку. */
let elistDarkStylePromise: Promise<StyleSpecification> | null = null;

export function getMapStyleUrl(theme: MapTheme = 'light'): string {
  return theme === 'dark' ? OPENFREEMAP_STYLE_DARK : OPENFREEMAP_STYLE_LIGHT;
}

/** @deprecated use getMapStyleUrl / resolveMapStyle */
export function getMapStyle(theme: MapTheme = 'light'): string {
  return getMapStyleUrl(theme);
}

/** OFM dark — нативный стиль, CSS-invert не нужен. */
export function mapDarkClass(
  theme: MapTheme,
  styles: Record<string, string>,
): string {
  if (theme !== 'dark') return '';
  return styles.mapDarkNative ?? '';
}

function setLayerPaint(
  style: StyleSpecification,
  layerId: string,
  props: Record<string, unknown>,
): void {
  const layer = style.layers?.find(l => l.id === layerId);
  if (!layer || !('paint' in layer) || !layer.paint) return;
  Object.assign(layer.paint, props);
}

function applyPaletteToStyle(style: StyleSpecification): void {
  const p = ELIST_DARK_MAP_PALETTE;

  setLayerPaint(style, 'background', { 'background-color': p.background });
  setLayerPaint(style, 'water', { 'fill-color': p.water });
  setLayerPaint(style, 'waterway', { 'line-color': p.water });
  setLayerPaint(style, 'landuse_residential', { 'fill-color': p.residential });
  // fiord: park opacity 0.3 / wood с alpha → серый «#8C8E9E» на холсте; делаем плотными
  setLayerPaint(style, 'landcover_wood', { 'fill-color': p.park, 'fill-opacity': 1 });
  setLayerPaint(style, 'park', { 'fill-color': p.park, 'fill-opacity': 0.92 });
  setLayerPaint(style, 'park_outline', { 'line-color': p.park });
  setLayerPaint(style, 'road_area_pier', { 'fill-color': p.background });
  setLayerPaint(style, 'road_pier', { 'line-color': p.streetMin });

  // fiord building fill-opacity=0.25 → дома почти сливаются с residential
  setLayerPaint(style, 'building', {
    'fill-color': p.building,
    'fill-opacity': 0.92,
  });

  for (const id of [
    'highway_major_inner',
    'highway_major_subtle',
    'highway_major_casing',
    'highway_motorway_inner',
    'highway_motorway_subtle',
    'highway_motorway_casing',
    'tunnel_motorway_casing',
    'tunnel_motorway_inner',
  ]) {
    setLayerPaint(style, id, { 'line-color': p.streetMaj });
  }

  for (const id of [
    'highway_minor',
    'highway_service',
    'highway_track',
    'highway_path',
    'aeroway-taxiway',
    'aeroway-runway-casing',
    'aeroway-runway',
  ]) {
    setLayerPaint(style, id, { 'line-color': p.streetMin });
  }
  setLayerPaint(style, 'aeroway-area', { 'fill-color': p.streetMin });
  // тропинки тоньше/тусклее ядра улиц
  setLayerPaint(style, 'highway_path', {
    'line-opacity': 0.55,
    'line-width': [
      'interpolate', ['exponential', 1.2], ['zoom'],
      13, 0.4,
      16, 1.2,
      20, 3,
    ],
  });
  setLayerPaint(style, 'highway_service', { 'line-opacity': 0.78 });
  setLayerPaint(style, 'highway_track', { 'line-opacity': 0.62 });

  for (const id of ['highway_minor', 'highway_major_inner', 'highway_motorway_inner']) {
    setLayerPaint(style, id, { 'line-blur': 0.35, 'line-opacity': 0.95 });
  }

  const landText = '#f0f1f7';
  const landHalo = 'rgba(22, 23, 30, 0.85)';
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
    setLayerPaint(style, id, { 'text-color': landText, 'text-halo-color': landHalo });
  }
  setLayerPaint(style, 'water_name', {
    'text-color': '#f0f1f7',
    'text-halo-color': 'rgba(26, 16, 64, 0.75)',
  });
}

/** Zoom-stops glow (эталон): [z, widthPx, blurPx, opacity] — множатся через ELIST_STREET_GLOW */
type GlowZoomStop = [zoom: number, width: number, blur: number, opacity: number];

function tuneGlowStops(stops: GlowZoomStop[]): GlowZoomStop[] {
  const { width, blur, opacity } = ELIST_STREET_GLOW;
  return stops.map(([z, w, b, o]) => [
    z,
    w * width,
    b * blur,
    Math.min(1, Math.max(0, o * opacity)),
  ]);
}

function glowInterpolate(stops: GlowZoomStop[], channel: 1 | 2 | 3): unknown[] {
  const tuned = tuneGlowStops(stops);
  const expr: unknown[] = ['interpolate', ['linear'], ['zoom']];
  for (const s of tuned) expr.push(s[0], s[channel]);
  return expr;
}

function roadClassFilter(className: string): FilterSpecification {
  return [
    'all',
    ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
    ['==', ['get', 'class'], className],
  ];
}

/**
 * Fiord сваливает minor+service+track в один highway_minor → на dark всё
 * одной толщины (особенно с glow). Liberty держит иерархию отдельно.
 * Разделяем слои и задаём ширины как у liberty: улица > двор/сервис > track > path.
 */
function splitSecondaryRoads(style: StyleSpecification): void {
  if (!style.layers) return;
  if (style.layers.some(l => l.id === 'highway_service')) return;
  const idx = style.layers.findIndex(l => l.id === 'highway_minor');
  if (idx < 0) return;
  const base = style.layers[idx];
  if (base.type !== 'line') return;

  base.filter = roadClassFilter('minor');
  if (!base.paint) base.paint = {};
  // улицы (residential / unclassified)
  (base.paint as Record<string, unknown>)['line-width'] = [
    'interpolate', ['exponential', 1.4], ['zoom'],
    12, 0.9,
    14, 2.6,
    16, 7,
    20, 16,
  ];

  const mk = (id: string, className: string, minzoom: number, width: unknown[], opacity: number) => {
    const layer = structuredClone(base) as LayerSpecification & {
      paint?: Record<string, unknown>;
      filter?: unknown;
      minzoom?: number;
    };
    layer.id = id;
    layer.filter = roadClassFilter(className);
    layer.minzoom = minzoom;
    layer.paint = {
      ...(layer.paint ?? {}),
      'line-width': width,
      'line-opacity': opacity,
    };
    return layer;
  };

  const service = mk(
    'highway_service',
    'service',
    14,
    [
      'interpolate', ['exponential', 1.2], ['zoom'],
      14, 0.5,
      16, 2,
      20, 7,
    ],
    0.78,
  );
  const track = mk(
    'highway_track',
    'track',
    14,
    [
      'interpolate', ['exponential', 1.2], ['zoom'],
      14, 0.35,
      16, 1.3,
      20, 4.5,
    ],
    0.62,
  );

  style.layers.splice(idx + 1, 0, service, track);
}

/**
 * Glow только у улиц/магистралей (не service/track/path).
 * Эталонные stop’ы × ELIST_STREET_GLOW (opacity/width/blur/цвета).
 */
function injectStreetGlow(style: StyleSpecification): void {
  if (!style.layers) return;
  const { colorMin, colorMaj, outerEnabled } = ELIST_STREET_GLOW;
  const targets: Array<{
    id: string;
    color: string;
    outer: GlowZoomStop[];
    inner: GlowZoomStop[];
  }> = [
    {
      id: 'highway_minor',
      color: colorMin,
      outer: [
        [12, 8, 7, 0.4],
        [14, 14, 11, 0.38],
        [17, 26, 18, 0.34],
        [20, 40, 24, 0.3],
      ],
      inner: [
        [12, 5, 3, 0.78],
        [14, 9, 5, 0.72],
        [17, 16, 8, 0.65],
        [20, 24, 11, 0.58],
      ],
    },
    {
      id: 'highway_major_subtle',
      color: colorMaj,
      outer: [
        [5, 7, 5, 0.45],
        [9, 11, 8, 0.4],
        [11, 14, 10, 0.36],
      ],
      inner: [
        [5, 4, 2.5, 0.8],
        [9, 7, 4, 0.72],
        [11, 9, 5, 0.65],
      ],
    },
    {
      id: 'highway_major_inner',
      color: colorMaj,
      outer: [
        [11, 10, 8, 0.42],
        [14, 18, 13, 0.38],
        [18, 30, 20, 0.34],
        [20, 42, 26, 0.3],
      ],
      inner: [
        [11, 6, 3.5, 0.8],
        [14, 12, 6, 0.72],
        [18, 20, 10, 0.62],
        [20, 28, 12, 0.55],
      ],
    },
    {
      id: 'highway_motorway_subtle',
      color: colorMaj,
      outer: [
        [4, 8, 6, 0.48],
        [6, 12, 9, 0.4],
      ],
      inner: [
        [4, 5, 3, 0.82],
        [6, 8, 4.5, 0.7],
      ],
    },
    {
      id: 'highway_motorway_inner',
      color: colorMaj,
      outer: [
        [6, 10, 8, 0.45],
        [12, 18, 13, 0.4],
        [16, 30, 20, 0.35],
        [20, 44, 26, 0.3],
      ],
      inner: [
        [6, 6, 3.5, 0.82],
        [12, 12, 6, 0.72],
        [16, 20, 10, 0.62],
        [20, 30, 12, 0.55],
      ],
    },
  ];

  const addGlow = (
    srcIdx: number,
    src: LayerSpecification,
    glowId: string,
    color: string,
    stops: GlowZoomStop[],
  ) => {
    if (style.layers!.some(l => l.id === glowId)) return srcIdx;
    const glow = structuredClone(src) as LayerSpecification & {
      paint?: Record<string, unknown>;
    };
    glow.id = glowId;
    const paint: Record<string, unknown> = { ...(glow.paint ?? {}) };
    paint['line-color'] = color;
    paint['line-width'] = glowInterpolate(stops, 1);
    paint['line-blur'] = glowInterpolate(stops, 2);
    paint['line-opacity'] = glowInterpolate(stops, 3);
    delete paint['line-dasharray'];
    glow.paint = paint;
    style.layers!.splice(srcIdx, 0, glow);
    return srcIdx + 1; // исходный слой сдвинулся вправо
  };

  for (const t of targets) {
    let idx = style.layers.findIndex(l => l.id === t.id);
    if (idx < 0) continue;
    const src = style.layers[idx];
    if (src.type !== 'line') continue;
    if (outerEnabled) {
      idx = addGlow(idx, src, `${t.id}-elist-glow-outer`, t.color, t.outer);
    }
    addGlow(idx, src, `${t.id}-elist-glow`, t.color, t.inner);
  }
}

/**
 * 3D-здания в стиле (не через addLayer на лету).
 * Плоский building не режем по maxzoom — иначе при сбое extrusion дома пропадают.
 */
function injectBuilding3d(style: StyleSpecification): void {
  if (!style.layers) return;
  if (style.layers.some(l => l.id === 'building-3d')) return;

  const buildingIdx = style.layers.findIndex(l => l.id === 'building');
  const layer: LayerSpecification = {
    id: 'building-3d',
    type: 'fill-extrusion',
    source: 'openmaptiles',
    'source-layer': 'building',
    minzoom: 14,
    filter: ['!', ['has', 'hide_3d']],
    paint: {
      'fill-extrusion-base': [
        'coalesce',
        ['to-number', ['get', 'render_min_height']],
        0,
      ],
      'fill-extrusion-color': ELIST_DARK_MAP_PALETTE.building,
      'fill-extrusion-height': [
        'max',
        ['coalesce', ['to-number', ['get', 'render_height']], 0],
        3,
      ],
      'fill-extrusion-opacity': 0.85,
    },
  };

  if (buildingIdx >= 0) style.layers.splice(buildingIdx + 1, 0, layer);
  else style.layers.push(layer);
}

async function getElistDarkStyle(): Promise<StyleSpecification> {
  if (!elistDarkStylePromise) {
    elistDarkStylePromise = fetch(OPENFREEMAP_STYLE_DARK)
      .then(r => {
        if (!r.ok) throw new Error(`OFM fiord style HTTP ${r.status}`);
        return r.json() as Promise<StyleSpecification>;
      })
      .then(style => {
        splitSecondaryRoads(style);
        applyPaletteToStyle(style);
        injectStreetGlow(style);
        injectBuilding3d(style);
        return style;
      })
      .catch(err => {
        elistDarkStylePromise = null;
        throw err;
      });
  }
  // clone: MapLibre может мутировать переданный объект
  const base = await elistDarkStylePromise;
  return structuredClone(base);
}

function pendingDarkStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'elist-dark-pending',
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': ELIST_DARK_MAP_PALETTE.background },
      },
    ],
  };
}

/**
 * Liberty (light) — building-3d уже есть.
 * Не трогаем zoom-range плоского building: обрезка maxzoom=14 + пустой
 * extrusion давала «пропажу» домов при пан/зуме.
 */
function ensureBuilding3d(map: MapLibreMap): void {
  if (!map.isStyleLoaded() || map.getLayer('building-3d')) return;
  if (!map.getSource('openmaptiles')) return;

  let color: string | unknown = '#aaa';
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
      'fill-extrusion-base': [
        'coalesce',
        ['to-number', ['get', 'render_min_height']],
        0,
      ],
      'fill-extrusion-color': color as string,
      'fill-extrusion-height': [
        'max',
        ['coalesce', ['to-number', ['get', 'render_height']], 0],
        3,
      ],
      'fill-extrusion-opacity': 0.85,
    },
  });
}

/**
 * Не даём уйти в сильный наклон (главный GPU-риск на мобилке).
 * Тёмная палитра уже в StyleSpecification — тут только pitch + light 3d.
 */
export function flattenMapView(map: MapLibreMap): void {
  if (!map.isMoving()) {
    map.setPitch(0);
    map.setBearing(0);
  } else {
    map.once('moveend', () => {
      map.setPitch(0);
      map.setBearing(0);
    });
  }
  const theme = mapThemeByInstance.get(map) ?? 'light';
  if (theme === 'light') ensureBuilding3d(map);
}

function applyStyleForTheme(map: MapLibreMap, theme: MapTheme): void {
  mapThemeByInstance.set(map, theme);
  if (theme === 'light') {
    map.setStyle(OPENFREEMAP_STYLE_LIGHT);
    return;
  }
  void getElistDarkStyle()
    .then(style => {
      if (mapThemeByInstance.get(map) !== 'dark') return;
      map.setStyle(style);
    })
    .catch(() => {
      // fallback: сырой fiord, без нашей палитры
      if (mapThemeByInstance.get(map) === 'dark') {
        map.setStyle(OPENFREEMAP_STYLE_DARK);
      }
    });
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
    // dark: короткий placeholder, затем запечённый fiord (без setPaintProperty на лету)
    style: theme === 'dark' ? pendingDarkStyle() : OPENFREEMAP_STYLE_LIGHT,
    center: [center[1], center[0]], // MapLibre: [lng, lat]
    zoom,
    interactive,
    scrollZoom,
    attributionControl: attributionControl ? undefined : false,
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

  if (theme === 'dark') {
    applyStyleForTheme(map, 'dark');
  }

  if (interactive) {
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
  }

  return map;
}

/** Смена light/dark: setStyle (слои событий перевешиваются на style.load). */
export function applyMapTheme(map: MapLibreMap, theme: MapTheme): void {
  applyStyleForTheme(map, theme);
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
