// features/event-map/YandexMap.tsx — просмотровая карта (MapLibre)

import { useEffect, useRef, useState } from 'react';
import {
  applyMapTheme,
  buildOsmPointUrl,
  createDotMarkerElement,
  createMap,
  disableMapPageScrollCapture,
  mapDarkClass,
  Marker,
  Popup,
  type MapLibreMap,
  type MapTheme,
} from '@/shared/lib/osmMap';
import { useThemeStore } from '@/app/store';
import styles from './YandexMap.module.css';

interface YandexMapProps { lat: number; lng: number; label?: string; zoom?: number; draggable?: boolean; }

const COORD_EPS = 1e-5;

function almostSame(a: [number, number], b: [number, number], eps = COORD_EPS): boolean {
  return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
}

export function YandexMap({ lat, lng, label, zoom = 15, draggable = true }: YandexMapProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const appliedThemeRef = useRef<MapTheme | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const { theme } = useThemeStore();
  const mapTheme: MapTheme = theme === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    if (!mapRef.current) return;
    let destroyed = false;

    try {
      const map = createMap(mapRef.current, {
        center: [lat, lng],
        zoom,
        theme: mapTheme,
        interactive: draggable,
        scrollZoom: draggable,
      });
      if (!draggable) {
        disableMapPageScrollCapture(map);
      }

      const marker = new Marker({
        element: createDotMarkerElement('#7c3aed', 16),
      })
        .setLngLat([lng, lat])
        .addTo(map);
      if (label) {
        marker.setPopup(new Popup({ offset: 12 }).setText(label));
      }

      mapInst.current = map;
      markerRef.current = marker;
      appliedThemeRef.current = mapTheme;
      map.once('load', () => {
        if (!destroyed) setReady(true);
        map.resize();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось инициализировать карту');
    }

    return () => {
      destroyed = true;
      markerRef.current?.remove();
      markerRef.current = null;
      mapInst.current?.remove();
      mapInst.current = null;
      setReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggable]);

  useEffect(() => {
    if (!ready || !mapInst.current) return;
    if (appliedThemeRef.current === mapTheme) return;
    appliedThemeRef.current = mapTheme;
    applyMapTheme(mapInst.current, mapTheme);
  }, [mapTheme, ready]);

  useEffect(() => {
    if (!ready || !mapInst.current) return;
    const map = mapInst.current;
    const coords: [number, number] = [lat, lng];
    const current = map.getCenter();
    const z = map.getZoom();
    if (!almostSame([current.lat, current.lng], coords) || Math.abs(z - zoom) >= 0.5) {
      map.easeTo({ center: [lng, lat], zoom, duration: 200 });
    }
    if (markerRef.current) {
      const p = markerRef.current.getLngLat();
      if (!almostSame([p.lat, p.lng], coords)) {
        markerRef.current.setLngLat([lng, lat]);
      }
    }
  }, [lat, lng, zoom, label, ready]);

  useEffect(() => {
    if (!ready || !mapInst.current || !wrapRef.current) return;
    const map = mapInst.current;
    const el = wrapRef.current;
    const fit = () => map.resize();
    fit();
    const observer = new ResizeObserver(() => fit());
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  if (error) return <div className={styles.errorBox}>{error}</div>;

  return (
    <div ref={wrapRef} className={styles.mapViewWrap}>
      <div
        ref={mapRef}
        className={`${styles.map} ${mapDarkClass(mapTheme, styles)}`}
      />
      <a
        className={styles.osmPointLink}
        href={buildOsmPointUrl(lat, lng, zoom)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Открыть в OpenStreetMap
      </a>
    </div>
  );
}
