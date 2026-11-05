// features/event-map/EventMap.tsx — главная карта (MapLibre + MapTiler)
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
  if (map.hasImage(id)) return;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`image load failed: ${id}`));
    image.src = url;
  });
  if (!map.hasImage(id)) {
    map.addImage(id, img, { pixelRatio: Math.min(3, Math.round(window.devicePixelRatio || 1)) });
  }
}

function ensureEventLayers(map: MapLibreMap): void {
  if (map.getSource(EVENTS_SOURCE)) return;

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
      // demotiles + MapTiler CDN: Open Sans Bold доступен в обоих
      'text-font': ['Open Sans Bold'],
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
  useEffect(() => { onSearchAreaRef.current = onSearchAreaChange; }, [onSearchAreaChange]);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [iconsReady, setIconsReady] = useState(false);
  const [styleEpoch, setStyleEpoch] = useState(0);

  useEffect(() => {
    let cancelled = false;
    preloadMapCategoryIcons().finally(() => {
      if (!cancelled) setIconsReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; lat: number; lng: number } | null>(null);

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

  useEffect(() => {
    if (!ctxMenu) return;
    const fn = () => setCtxMenu(null);
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [ctxMenu]);

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

  const handleSearchHere = (lat: number, lng: number, radius: number) => {
    setCtxMenu(null);
    window.dispatchEvent(new CustomEvent('elist:searchHere', { detail: { lat, lng, radius } }));
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let destroyed = false;
    let handlePointerDown: ((e: PointerEvent) => void) | null = null;
    let handlePointerUp: (() => void) | null = null;
    let handlePointerMove: ((e: PointerEvent) => void) | null = null;
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
        ensureEventLayers(map);
        setStyleEpoch(e => e + 1);
        scheduleSearchArea();
      };
      map.on('load', onStyleReady);
      map.on('styledata', () => {
        if (map.isStyleLoaded()) {
          ensureEventLayers(map);
          setStyleEpoch(e => e + 1);
        }
      });

      map.on('contextmenu', (e) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        setCtxMenu({
          x: e.originalEvent.clientX - rect.left,
          y: e.originalEvent.clientY - rect.top,
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
        });
        setGroupState(null);
      });

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

      let longPressTimer: ReturnType<typeof setTimeout> | null = null;
      let longPressMoved = false;
      let longPressX = 0;
      let longPressY = 0;

      handlePointerDown = (e: PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        longPressMoved = false;
        longPressX = e.clientX;
        longPressY = e.clientY;
        longPressTimer = setTimeout(() => {
          if (longPressMoved || !el || !mapRef.current) return;
          const rect = el.getBoundingClientRect();
          const x = longPressX - rect.left;
          const y = longPressY - rect.top;
          const ll = mapRef.current.unproject([x, y]);
          setCtxMenu({ x, y, lat: ll.lat, lng: ll.lng });
          setGroupState(null);
          if (navigator.vibrate) navigator.vibrate(40);
        }, 600);
      };
      handlePointerUp = () => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      };
      handlePointerMove = (e: PointerEvent) => {
        const dx = e.clientX - longPressX;
        const dy = e.clientY - longPressY;
        if (Math.sqrt(dx * dx + dy * dy) > 8) {
          longPressMoved = true;
          if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        }
      };
      el.addEventListener('pointerdown', handlePointerDown);
      el.addEventListener('pointerup', handlePointerUp);
      el.addEventListener('pointermove', handlePointerMove);
      el.addEventListener('pointercancel', handlePointerUp);

      if (!destroyed) setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось инициализировать карту');
    }

    return () => {
      destroyed = true;
      if (searchAreaTimer) clearTimeout(searchAreaTimer);
      if (el) {
        if (handlePointerDown) el.removeEventListener('pointerdown', handlePointerDown);
        if (handlePointerUp) el.removeEventListener('pointerup', handlePointerUp);
        if (handlePointerMove) el.removeEventListener('pointermove', handlePointerMove);
        if (handlePointerUp) el.removeEventListener('pointercancel', handlePointerUp);
      }
      mapRef.current?.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    applyMapTheme(mapRef.current, mapTheme);
  }, [mapTheme, ready]);

  useEffect(() => {
    if (!ready || !mapRef.current || !containerRef.current) return;
    const map = mapRef.current;
    const el = containerRef.current;
    const fit = () => map.resize();
    fit();
    const observer = new ResizeObserver(() => fit());
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const c = map.getCenter();
    const [lat, lng] = center;
    if (Math.abs(c.lat - lat) < 0.0001 && Math.abs(c.lng - lng) < 0.0001) return;
    map.easeTo({ center: [lng, lat], zoom, duration: ready ? 400 : 0 });
  }, [center, zoom, ready]);

  useEffect(() => {
    if (!ready || !iconsReady || !mapRef.current) return;
    const map = mapRef.current;
    if (!map.getSource(EVENTS_SOURCE)) {
      ensureEventLayers(map);
    }

    const groups = new Map<string, IEventSearchShortItem[]>();
    for (const ev of events) {
      if (ev.latitude == null || ev.longitude == null) continue;
      const key = coordKey(ev.latitude, ev.longitude);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ev);
    }
    groupsRef.current = groups;

    void (async () => {
      const features: GeoJSON.Feature[] = [];
      for (const [key, group] of groups) {
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

      const source = map.getSource(EVENTS_SOURCE) as GeoJSONSource | undefined;
      if (!source) return;
      source.setData({ type: 'FeatureCollection', features });
    })();
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

      {ctxMenu && (
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: Math.min(ctxMenu.x + 4, (containerRef.current?.offsetWidth ?? 300) - 190),
            top: Math.min(ctxMenu.y + 4, (containerRef.current?.offsetHeight ?? 400) - 200),
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 4px 24px rgba(0,0,0,0.28)',
            zIndex: 1100,
            minWidth: 180,
            overflow: 'hidden',
          }}
        >
          <div style={{
            padding: '8px 14px 6px',
            fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: 'var(--text-secondary)',
            borderBottom: '1px solid var(--border)',
          }}>
            Искать поблизости
          </div>
          {[
            { label: '300 м', radius: 300 },
            { label: '500 м', radius: 500 },
            { label: '1 км', radius: 1000 },
            { label: '3 км', radius: 3000 },
            { label: '5 км', radius: 5000 },
          ].map(({ label, radius }) => (
            <button key={radius}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '9px 14px', background: 'none', border: 'none',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', textAlign: 'left',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              onClick={() => handleSearchHere(ctxMenu.lat, ctxMenu.lng, radius)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="3" fill="var(--accent)" stroke="none"/>
              </svg>
              {label}
            </button>
          ))}
        </div>
      )}

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
