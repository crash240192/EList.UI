// features/event-map/EventMap.tsx — главная карта (Leaflet + OSM)
// Балуны отключены — всё через React-компоненты.
// При совпадении координат показываем список мероприятий на точке.

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import type { IEventSearchShortItem } from '@/entities/event';
import { createOsmTileLayer, haversineMeters } from '@/shared/lib/osmMap';
import { placePointGroupModal, type PointGroupPlacement } from './pointGroupPlacement';
import { useFiltersStore, useThemeStore } from '@/app/store';
import {
  MAP_MARKER_ICON_SIZE,
  displayMarkerColor,
  drawMarkerIconTinted,
  getCachedMarkerIcon,
  preloadMapCategoryIcons,
  resolveMarkerVisual,
  type MarkerTypeCategoryFilter,
} from './mapCategoryIcons';
import styles from './YandexMap.module.css';

export interface MapSearchArea {
  lat: number;
  lng: number;
  /** Радиус в метрах — по видимой области (центр → дальний угол bbox) */
  radiusM: number;
}

interface EventMapProps {
  events: IEventSearchShortItem[];
  onMarkerClick: (eventId: string) => void;
  center?: [number, number];
  zoom?: number;
  onCenterChange?: (center: [number, number]) => void;
  onZoomChange?: (zoom: number) => void;
  /** Видимая область карты → поиск (центр + радиус + зум для подписи города) */
  onSearchAreaChange?: (area: MapSearchArea) => void;
  searchAreaDebounceMs?: number;
}

const DEFAULT_COLOR = '#6366f1';

function markerColors(item: IEventSearchShortItem): string[] {
  const c = item.colors?.filter(Boolean) ?? [];
  return c.length ? [...new Set(c)] : [DEFAULT_COLOR];
}

/**
 * PNG-маркер: заливка цветом категории иконки; кант — цвета категорий (секторами).
 * count > 1 — число вместо иконки. Цвета не зависят от темы UI.
 */
function makeMarkerPng(
  colors: string[],
  count = 1,
  filter?: MarkerTypeCategoryFilter | null,
): string {
  const size = 36;
  const dpr = typeof window !== 'undefined'
    ? Math.max(1, Math.min(3, Math.round(window.devicePixelRatio || 1)))
    : 1;
  const c = document.createElement('canvas');
  c.width = size * dpr;
  c.height = size * dpr;
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const cx = size / 2; const cy = size / 2;
  const outerR = 15;
  const ringW = 3.5;
  const innerR = outerR - ringW;

  const visual = resolveMarkerVisual(colors, filter, DEFAULT_COLOR);
  const ringColors = visual.ringColors;

  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 1.25, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fill();

  if (ringColors.length === 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, 2 * Math.PI);
    ctx.fillStyle = ringColors[0];
    ctx.fill();
  } else {
    const step = (2 * Math.PI) / ringColors.length;
    ringColors.forEach((color, i) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, i * step - Math.PI / 2, (i + 1) * step - Math.PI / 2);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, 2 * Math.PI);
  ctx.fillStyle = visual.fill;
  ctx.fill();

  if (count > 1) {
    ctx.fillStyle = visual.ink;
    ctx.font = `bold 11px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(count), cx, cy + 1);
  } else {
    const icon = getCachedMarkerIcon(visual.iconUrl);
    if (icon) {
      const iconBox = MAP_MARKER_ICON_SIZE;
      drawMarkerIconTinted(
        ctx,
        icon,
        Math.round(cx - iconBox / 2),
        Math.round(cy - iconBox / 2),
        iconBox,
        visual.ink,
      );
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
      ctx.fillStyle = visual.ink;
      ctx.fill();
    }
  }

  return c.toDataURL('image/png');
}

const coordKey = (lat: number, lng: number) =>
  `${lat.toFixed(5)},${lng.toFixed(5)}`;

type MarkerWithGroup = L.Marker & { _elistGroup?: IEventSearchShortItem[] };

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
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const onSearchAreaRef = useRef(onSearchAreaChange);
  useEffect(() => { onSearchAreaRef.current = onSearchAreaChange; }, [onSearchAreaChange]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [iconsReady, setIconsReady] = useState(false);

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
      mapRef.current.setView(target, 12, { animate: true });
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
      const map = L.map(el, {
        center,
        zoom,
        zoomControl: true,
        attributionControl: true,
      });
      createOsmTileLayer().addTo(map);
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
      requestAnimationFrame(() => {
        map.invalidateSize();
        scheduleSearchArea();
      });

      map.on('contextmenu', (e: L.LeafletMouseEvent) => {
        if (!el) return;
        e.originalEvent.preventDefault();
        const rect = el.getBoundingClientRect();
        setCtxMenu({
          x: e.originalEvent.clientX - rect.left,
          y: e.originalEvent.clientY - rect.top,
          lat: e.latlng.lat,
          lng: e.latlng.lng,
        });
        setGroupState(null);
      });

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
          const coords = mapRef.current.containerPointToLatLng(L.point(x, y));
          setCtxMenu({ x, y, lat: coords.lat, lng: coords.lng });
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
      if (searchAreaTimer) {
        clearTimeout(searchAreaTimer);
        searchAreaTimer = null;
      }
      if (el) {
        if (handlePointerDown) el.removeEventListener('pointerdown', handlePointerDown);
        if (handlePointerUp) el.removeEventListener('pointerup', handlePointerUp);
        if (handlePointerMove) el.removeEventListener('pointermove', handlePointerMove);
        if (handlePointerUp) el.removeEventListener('pointercancel', handlePointerUp);
      }
      clusterRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !containerRef.current) return;
    const map = mapRef.current;
    const el = containerRef.current;
    const fit = () => map.invalidateSize();
    fit();
    const observer = new ResizeObserver(() => fit());
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const current = map.getCenter();
    const [lat, lng] = center;
    if (Math.abs(current.lat - lat) < 0.0001 && Math.abs(current.lng - lng) < 0.0001) return;
    map.setView(center, zoom, { animate: ready });
  }, [center, zoom, ready]);

  useEffect(() => {
    if (!ready || !iconsReady || !mapRef.current) return;
    const map = mapRef.current;

    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
      clusterRef.current = null;
    }

    const groups = new Map<string, IEventSearchShortItem[]>();
    for (const ev of events) {
      if (ev.latitude == null || ev.longitude == null) continue;
      const key = coordKey(ev.latitude, ev.longitude);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ev);
    }

    const clusterer = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: false,
    });

    for (const [, group] of groups) {
      const first = group[0];
      const ringSource = group.length === 1
        ? markerColors(first)
        : [...new Set(group.flatMap(ev => markerColors(ev)))];
      const icon = L.icon({
        iconUrl: makeMarkerPng(ringSource, group.length, markerFilter),
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      const marker = L.marker([first.latitude!, first.longitude!], { icon }) as MarkerWithGroup;
      marker._elistGroup = group;
      marker.on('click', (e: L.LeafletMouseEvent) => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          showGroup(group, e.originalEvent.clientX - rect.left, e.originalEvent.clientY - rect.top);
        } else {
          showGroup(group, -1, -1);
        }
      });
      clusterer.addLayer(marker);
    }

    clusterer.on('clusterclick', (e: L.LeafletEvent) => {
      const cluster = (e as L.LeafletMouseEvent & { layer: L.MarkerCluster }).layer;
      const childMarkers = cluster.getAllChildMarkers?.() as MarkerWithGroup[] | undefined;
      const clusterEvents: IEventSearchShortItem[] = [];
      childMarkers?.forEach((pm) => {
        (pm._elistGroup ?? []).forEach((ev) => clusterEvents.push(ev));
      });
      if (clusterEvents.length > 0) {
        const oe = (e as L.LeafletMouseEvent).originalEvent;
        if (containerRef.current && oe) {
          const rect = containerRef.current.getBoundingClientRect();
          showGroup(clusterEvents, oe.clientX - rect.left, oe.clientY - rect.top);
        } else {
          showGroup(clusterEvents, -1, -1);
        }
      }
    });

    map.addLayer(clusterer);
    clusterRef.current = clusterer;
  }, [events, showGroup, ready, iconsReady, filterCategories, filterTypes]);

  if (error) return (
    <div className={styles.errorBox} style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {error}
    </div>
  );

  return (
    <div className={styles.eventsMapWrap}>
      <div
        ref={containerRef}
        className={`${styles.eventsMap} ${theme === 'dark' ? styles.eventsMapDark : ''}`}
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
            zIndex: 50,
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
            const color = displayMarkerColor(markerColors(ev)[0], DEFAULT_COLOR);
            return (
              <button key={ev.id} className={styles.groupItem} onClick={() => onSelect(ev.id)}>
                <div className={styles.groupDot} style={{ background: color }} />
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
