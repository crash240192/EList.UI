// features/event-map/YandexMap.tsx — просмотровая карта (Leaflet + OSM)

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  addCompactZoomControl,
  buildOsmPointUrl,
  createDotIcon,
  createOsmTileLayer,
  disableMapPageScrollCapture,
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
  const mapInst = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const { theme } = useThemeStore();

  useEffect(() => {
    if (!mapRef.current) return;
    let destroyed = false;

    try {
      const map = L.map(mapRef.current, {
        center: [lat, lng],
        zoom,
        zoomControl: false,
        attributionControl: true,
      });
      createOsmTileLayer().addTo(map);
      addCompactZoomControl(map);
      if (!draggable) {
        disableMapPageScrollCapture(map);
      }

      const marker = L.marker([lat, lng], {
        icon: createDotIcon('#7c3aed', 16),
        title: label ?? '',
      }).addTo(map);

      mapInst.current = map;
      markerRef.current = marker;
      if (!destroyed) setReady(true);

      requestAnimationFrame(() => map.invalidateSize());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось инициализировать карту');
    }

    return () => {
      destroyed = true;
      markerRef.current = null;
      mapInst.current?.remove();
      mapInst.current = null;
      setReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggable]);

  useEffect(() => {
    if (!ready || !mapInst.current) return;
    const map = mapInst.current;
    const coords: [number, number] = [lat, lng];
    const current = map.getCenter();
    const z = map.getZoom();
    if (!almostSame([current.lat, current.lng], coords) || Math.abs(z - zoom) >= 0.5) {
      map.setView(coords, zoom, { animate: true });
    }
    if (markerRef.current) {
      const p = markerRef.current.getLatLng();
      if (!almostSame([p.lat, p.lng], coords)) {
        markerRef.current.setLatLng(coords);
      }
      if (label) markerRef.current.bindTooltip(label);
    }
  }, [lat, lng, zoom, label, ready]);

  useEffect(() => {
    if (!ready || !mapInst.current || !wrapRef.current) return;
    const map = mapInst.current;
    const el = wrapRef.current;
    const fit = () => map.invalidateSize();
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
        className={`${styles.map} ${theme === 'dark' ? styles.mapDark : ''}`}
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
