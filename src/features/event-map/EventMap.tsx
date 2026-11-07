// features/event-map/EventMap.tsx — главная карта (MapLibre + OpenFreeMap)
// При совпадении координат — список мероприятий; рядом — кластеры GeoJSON.

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import type { GeoJSON } from 'geojson';
import type { IEventSearchShortItem } from '@/entities/event';
import {
  createMap,
  applyMapTheme,
  haversineMeters,
  mapDarkClass,
  type GeoJSONSource,
  type MapLibreMap,
  type MapTheme,
} from '@/shared/lib/osmMap';
import { placePointGroupModal, type PointGroupPlacement } from './pointGroupPlacement';
import { useFiltersStore, useThemeStore } from '@/app/store';
import {
  DEFAULT_MARKER_COLOR,
  makeMarkerPng,
  preloadMapCategoryIcons,
  type MarkerTypeCategoryFilter,
} from './mapCategoryIcons';
import styles from './YandexMap.module.css';

export interface MapSearchArea {
  lat: number;
  lng: number;
  radiusM: number;
}

interface EventMapProps {
  events: IEventSearchShortItem[];
  onMarkerClick: (eventId: string) => void;
  center?: [number, number];
  zoom?: number;
  onCenterChange?: (center: [number, number]) => void;
  onZoomChange?: (zoom: number) => void;
  onSearchAreaChange?: (area: MapSearchArea) => void;
  searchAreaDebounceMs?: number;
}

const EVENTS_SOURCE = 'elist-events';
const LAYER_CLUSTERS = 'elist-clusters';
const LAYER_CLUSTER_COUNT = 'elist-cluster-count';
const LAYER_UNCLUSTERED = 'elist-unclustered';

function markerColors(item: IEventSearchShortItem): string[] {
  const c = item.colors?.filter(Boolean) ?? [];
  return c.length ? [...new Set(c)] : [DEFAULT_MARKER_COLOR];
}

const coordKey = (lat: number, lng: number) =>
  `${lat.toFixed(5)},${lng.toFixed(5)}`;

async function ensureImage(map: MapLibreMap, id: string, url: string): Promise<void> {
  if (!map.isStyleLoaded()) return;
  if (map.hasImage(id)) return;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`image load failed: ${id}`));
    image.src = url;
  });
  if (!map.isStyleLoaded() || map.hasImage(id)) return;
  map.addImage(id, img, { pixelRatio: Math.min(3, Math.round(window.devicePixelRatio || 1)) });
}

/** false = стиль ещё не готов, слои появятся на style.load. */
function ensureEventLayers(map: MapLibreMap): boolean {
  if (!map.isStyleLoaded()) return false;
  if (map.getSource(EVENTS_SOURCE)) return true;

  try {
    map.addSource(EVENTS_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterMaxZoom: 16,
      clusterRadius: 60,
    });

    map.addLayer({
      id: LAYER_CLUSTERS,
      type: 'circle',
      source: EVENTS_SOURCE,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#6366f1',
        'circle-stroke-color': 'rgba(255,255,255,0.55)',
        'circle-stroke-width': 2,
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          16,
          10, 20,
          40, 24,
        ],
      },
    });

    map.addLayer({
      id: LAYER_CLUSTER_COUNT,
      type: 'symbol',
      source: EVENTS_SOURCE,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 12,
        // OpenFreeMap liberty/dark: Noto Sans*
        'text-font': ['Noto Sans Bold'],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#ffffff',
      },
    });

    map.addLayer({
      id: LAYER_UNCLUSTERED,
      type: 'symbol',
      source: EVENTS_SOURCE,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': 1,
        'icon-allow-overlap': true,
        'icon-anchor': 'center',
      },
    });
    return true;
  } catch {
    // Style is not done loading / mid setStyle — ждём следующий style.load
    return false;
  }
}

export function EventMap({
  events,
  onMarkerClick,
  center = [55.7558, 37.6173],
  zoom = 12,
  onCenterChange,
  onZoomChange,
  onSearchAreaChange,
  searchAreaDebounceMs = 400,
}: EventMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const groupsRef = useRef(new Map<string, IEventSearchShortItem[]>());
  const onSearchAreaRef = useRef(onSearchAreaChange);
  const showGroupRef = useRef<(group: IEventSearchShortItem[], x: number, y: number) => void>(() => {});
  const appliedThemeRef = useRef<MapTheme | null>(null);
  useEffect(() => { onSearchAreaRef.current = onSearchAreaChange; }, [onSearchAreaChange]);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [iconsReady, setIconsReady] = useState(false);
  /** Инкремент на каждый успешный style.load — пересоздать слои/иконки после setStyle. */
  const [styleEpoch, setStyleEpoch] = useState(0);

  useEffect(() => {
    let cancelled = false;
    preloadMapCategoryIcons().finally(() => {
      if (!cancelled) setIconsReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  const centerRef = useRef(center);
  useEffect(() => { centerRef.current = center; }, [center]);

  useEffect(() => {
    const handler = (e: Event) => {
      if (!mapRef.current) return;
      const detail = (e as CustomEvent<{ lat?: number; lng?: number } | null>).detail;
      const target: [number, number] = (detail?.lat && detail?.lng)
        ? [detail.lat, detail.lng]
        : centerRef.current;
      mapRef.current.easeTo({ center: [target[1], target[0]], zoom: 12 });
    };
    window.addEventListener('elist:centerMap', handler);
    return () => window.removeEventListener('elist:centerMap', handler);
  }, []);

  const { theme } = useThemeStore();
  const mapTheme: MapTheme = theme === 'dark' ? 'dark' : 'light';
  const filterCategories = useFiltersStore(s => s.filters.categories);
  const filterTypes = useFiltersStore(s => s.filters.types);
  const markerFilter: MarkerTypeCategoryFilter = {
    categories: filterCategories,
    types: filterTypes,
  };

  const [groupState, setGroupState] = useState<{ events: IEventSearchShortItem[]; x: number; y: number } | null>(null);

  const showGroup = useCallback((group: IEventSearchShortItem[], x: number, y: number) => {
    if (group.length === 1) {
      onMarkerClick(group[0].id);
      return;
    }
    setGroupState({ events: group, x, y });
  }, [onMarkerClick]);
  showGroupRef.current = showGroup;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let destroyed = false;
    let searchAreaTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      const map = createMap(el, {
        center,
        zoom,
        theme: mapTheme,
        interactive: true,
      });
      mapRef.current = map;

      const emitSearchArea = () => {
        const cb = onSearchAreaRef.current;
        if (!cb || !mapRef.current) return;
        const m = mapRef.current;
        const c = m.getCenter();
        const bounds = m.getBounds();
        const centerPt: [number, number] = [c.lat, c.lng];
        const corners: [number, number][] = [
          [bounds.getSouthWest().lat, bounds.getSouthWest().lng],
          [bounds.getSouthWest().lat, bounds.getNorthEast().lng],
          [bounds.getNorthEast().lat, bounds.getSouthWest().lng],
          [bounds.getNorthEast().lat, bounds.getNorthEast().lng],
        ];
        let radiusM = 0;
        for (const q of corners) {
          const d = haversineMeters(centerPt, q);
          if (d > radiusM) radiusM = d;
        }
        radiusM = Math.round(Math.max(200, Math.min(radiusM, 5_000_000)));
        cb({ lat: c.lat, lng: c.lng, radiusM });
      };

      const scheduleSearchArea = () => {
        if (!onSearchAreaRef.current) return;
        if (searchAreaTimer) clearTimeout(searchAreaTimer);
        searchAreaTimer = setTimeout(() => {
          searchAreaTimer = null;
          emitSearchArea();
        }, searchAreaDebounceMs);
      };

      const onViewportChange = () => {
        const c = map.getCenter();
        const z = map.getZoom();
        const next: [number, number] = [c.lat, c.lng];
        centerRef.current = next;
        onCenterChange?.(next);
        onZoomChange?.(z);
        scheduleSearchArea();
      };

      map.on('moveend', onViewportChange);
      map.on('zoomend', onViewportChange);

      const onStyleReady = () => {
        if (destroyed) return;
        ensureEventLayers(map);
        setStyleEpoch(e => e + 1);
        setReady(true);
        scheduleSearchArea();
      };
      // load — первый стиль; style.load — после setStyle (смена темы)
      map.on('load', onStyleReady);
      map.on('style.load', onStyleReady);
      map.on('error', (e) => {
        const msg = e.error?.message ?? 'Ошибка загрузки карты';
        if (!destroyed) setError(msg);
      });

      appliedThemeRef.current = mapTheme;

      // Без меню радиуса: глушим нативный context menu браузера на карте
      map.on('contextmenu', (e) => { e.preventDefault(); });

      map.on('click', LAYER_UNCLUSTERED, (e) => {
        const f = e.features?.[0];
        const gid = f?.properties?.groupId as string | undefined;
        if (!gid) return;
        const group = groupsRef.current.get(gid);
        if (!group) return;
        const rect = el.getBoundingClientRect();
        showGroupRef.current(
          group,
          e.originalEvent.clientX - rect.left,
          e.originalEvent.clientY - rect.top,
        );
      });

      map.on('click', LAYER_CLUSTERS, async (e) => {
        const f = e.features?.[0];
        if (!f || f.properties?.cluster_id == null) return;
        const source = map.getSource(EVENTS_SOURCE) as GeoJSONSource;
        const clusterId = f.properties.cluster_id as number;
        const leaves = await source.getClusterLeaves(clusterId, 200, 0);
        const clusterEvents: IEventSearchShortItem[] = [];
        for (const leaf of leaves) {
          const gid = leaf.properties?.groupId as string | undefined;
          if (!gid) continue;
          const g = groupsRef.current.get(gid);
          if (g) clusterEvents.push(...g);
        }
        if (clusterEvents.length === 0) return;
        const rect = el.getBoundingClientRect();
        showGroupRef.current(
          clusterEvents,
          e.originalEvent.clientX - rect.left,
          e.originalEvent.clientY - rect.top,
        );
      });

      map.on('mouseenter', LAYER_CLUSTERS, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', LAYER_CLUSTERS, () => { map.getCanvas().style.cursor = ''; });
      map.on('mouseenter', LAYER_UNCLUSTERED, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', LAYER_UNCLUSTERED, () => { map.getCanvas().style.cursor = ''; });
      // ready — только после load/style.load (см. onStyleReady)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось инициализировать карту');
    }

    return () => {
      destroyed = true;
      if (searchAreaTimer) clearTimeout(searchAreaTimer);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    // Не вызывать setStyle на первом ready — стиль уже задан в createMap.
    // Иначе гонка: addSource до конца загрузки → "Style is not done loading".
    if (appliedThemeRef.current === mapTheme) return;
    appliedThemeRef.current = mapTheme;
    applyMapTheme(mapRef.current, mapTheme);
  }, [mapTheme, ready]);

  useEffect(() => {
    if (!ready || !mapRef.current || !containerRef.current) return;
    const map = mapRef.current;
    const el = containerRef.current;
    const fit = () => {
      if (map.isStyleLoaded()) map.resize();
      else map.once('idle', () => map.resize());
    };
    fit();
    const observer = new ResizeObserver(() => fit());
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    if (!map.isStyleLoaded()) return;
    const c = map.getCenter();
    const [lat, lng] = center;
    if (Math.abs(c.lat - lat) < 0.0001 && Math.abs(c.lng - lng) < 0.0001) return;
    map.easeTo({ center: [lng, lat], zoom, duration: 400 });
  }, [center, zoom, ready]);

  useEffect(() => {
    if (!ready || !iconsReady || !mapRef.current) return;
    const map = mapRef.current;
    if (!ensureEventLayers(map)) return;

    const groups = new Map<string, IEventSearchShortItem[]>();
    for (const ev of events) {
      if (ev.latitude == null || ev.longitude == null) continue;
      const key = coordKey(ev.latitude, ev.longitude);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ev);
    }
    groupsRef.current = groups;

    let cancelled = false;
    void (async () => {
      const features: GeoJSON.Feature[] = [];
      for (const [key, group] of groups) {
        if (cancelled) return;
        const first = group[0];
        const ringSource = group.length === 1
          ? markerColors(first)
          : [...new Set(group.flatMap(ev => markerColors(ev)))];
        const iconId = `ev-${key.replace(/[^0-9a-z-]/gi, '_')}`;
        const png = makeMarkerPng(ringSource, group.length, markerFilter);
        try {
          await ensureImage(map, iconId, png);
        } catch {
          continue;
        }
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [first.longitude!, first.latitude!],
          },
          properties: {
            groupId: key,
            icon: iconId,
          },
        });
      }

      if (cancelled || !map.isStyleLoaded()) return;
      const source = map.getSource(EVENTS_SOURCE) as GeoJSONSource | undefined;
      if (!source) return;
      source.setData({ type: 'FeatureCollection', features });
    })();
    return () => { cancelled = true; };
  }, [events, ready, iconsReady, filterCategories, filterTypes, styleEpoch, markerFilter]);

  if (error) return (
    <div className={styles.errorBox} style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {error}
    </div>
  );

  return (
    <div className={styles.eventsMapWrap}>
      <div
        ref={containerRef}
        className={`${styles.eventsMap} ${mapDarkClass(mapTheme, styles)}`}
      />

      {groupState && (
        <PointGroupModal
          events={groupState.events}
          anchorX={groupState.x}
          anchorY={groupState.y}
          onSelect={id => { setGroupState(null); onMarkerClick(id); }}
          onClose={() => setGroupState(null)}
        />
      )}
    </div>
  );
}

export function PointGroupModal({ events, anchorX, anchorY, onSelect, onClose }: {
  events: IEventSearchShortItem[];
  anchorX: number;
  anchorY: number;
  onSelect: (eventId: string) => void;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<PointGroupPlacement | null>(null);
  const positioned = anchorX >= 0 && anchorY >= 0;
  const filterCategories = useFiltersStore(s => s.filters.categories);
  const filterTypes = useFiltersStore(s => s.filters.types);
  const markerFilter: MarkerTypeCategoryFilter = {
    categories: filterCategories,
    types: filterTypes,
  };

  useLayoutEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    const wrap = modal.offsetParent as HTMLElement | null;
    if (!wrap) return;

    const measure = () => {
      const list = modal.querySelector<HTMLElement>('[data-group-list]');
      const header = modal.querySelector<HTMLElement>('[data-group-header]');
      if (list) list.style.maxHeight = '240px';
      const rect = wrap.getBoundingClientRect();
      const viewport = window.visualViewport;
      const next = placePointGroupModal({
        anchorX,
        anchorY,
        positioned,
        wrapLeft: rect.left,
        wrapTop: rect.top,
        wrapWidth: rect.width,
        wrapHeight: rect.height,
        viewportLeft: viewport?.offsetLeft ?? 0,
        viewportTop: viewport?.offsetTop ?? 0,
        viewportWidth: viewport?.width ?? window.innerWidth,
        viewportHeight: viewport?.height ?? window.innerHeight,
        naturalHeight: modal.offsetHeight,
        headerHeight: header?.offsetHeight ?? 0,
      });
      if (list) list.style.maxHeight = `${next.listMaxHeight}px`;
      setPlace(next);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('scroll', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('scroll', measure);
    };
  }, [anchorX, anchorY, positioned, events.length]);

  return (
    <>
      <div className={styles.groupBackdrop} onClick={onClose} />
      <div
        ref={modalRef}
        className={styles.groupModal}
        style={{
          position: 'absolute',
          visibility: place ? 'visible' : 'hidden',
          left: place?.left ?? 0,
          top: place?.top ?? 0,
          width: place?.width ?? 300,
        }}
      >
        <div className={styles.groupHeader} data-group-header>
          <span className={styles.groupTitle}>
            {events.length} мероприятия в этой точке
          </span>
          <button className={styles.groupClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.groupList} data-group-list style={{ maxHeight: place?.listMaxHeight }}>
          {events.map(ev => {
            const iconSrc = makeMarkerPng(markerColors(ev), 1, markerFilter);
            return (
              <button key={ev.id} className={styles.groupItem} onClick={() => onSelect(ev.id)}>
                <img
                  className={styles.groupMarkerIcon}
                  src={iconSrc}
                  alt=""
                  width={28}
                  height={28}
                  draggable={false}
                />
                <div className={styles.groupItemInfo}>
                  <span className={styles.groupItemName}>{ev.name}</span>
                  <span className={styles.groupItemMeta}>Подробнее</span>
                </div>
                <span className={styles.groupArrow}>›</span>
              </button>
            );
          })}
        </div>
        {positioned && place && (
          <div
            className={styles.groupTail}
            style={place.tailAbove
              ? { bottom: -7, top: 'auto', left: place.tailLeft }
              : { top: -7, bottom: 'auto', left: place.tailLeft, transform: 'rotate(180deg)' }
            }
          />
        )}
      </div>
    </>
  );
}
