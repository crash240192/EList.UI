// features/event-map/PickerMapView.tsx — выбор точки (MapLibre)

import { useEffect, useRef, useState } from 'react';
import { reverseGeocode } from '@/shared/lib/geocode';
import {
  applyMapTheme,
  createDotMarkerElement,
  createMap,
  DEFAULT_MAP_CENTER,
  mapDarkClass,
  Marker,
  setPickerBehaviors,
  type MapLibreMap,
  type MapTheme,
} from '@/shared/lib/osmMap';
import { useThemeStore } from '@/app/store';
import styles from './YandexMap.module.css';

interface PickerMapViewProps {
  lat: number | null;
  lng: number | null;
  address: string;
  initialCenter?: [number, number];
  panEnabled?: boolean;
  className?: string;
  onPick: (lat: number, lng: number, address: string) => void;
  onAddressChange: (address: string) => void;
  onGeocodingChange?: (geocoding: boolean) => void;
}

const COORD_EPS = 1e-5;
const REVERSE_DEBOUNCE_MS = 320;

function almostSame(a: [number, number], b: [number, number], eps = COORD_EPS): boolean {
  return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
}

export function PickerMapView({
  lat,
  lng,
  address,
  initialCenter,
  panEnabled = false,
  className,
  onPick,
  onAddressChange,
  onGeocodingChange,
}: PickerMapViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const appliedThemeRef = useRef<MapTheme | null>(null);
  const callbacksRef = useRef({ onPick, onAddressChange, onGeocodingChange, address });
  const reverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reverseGenRef = useRef(0);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const { theme } = useThemeStore();
  const mapTheme: MapTheme = theme === 'dark' ? 'dark' : 'light';

  callbacksRef.current = { onPick, onAddressChange, onGeocodingChange, address };

  useEffect(() => {
    if (!ref.current) return;
    let destroyed = false;

    const clearReverseTimer = () => {
      if (reverseTimerRef.current) {
        clearTimeout(reverseTimerRef.current);
        reverseTimerRef.current = null;
      }
    };

    try {
      const center: [number, number] = lat !== null && lng !== null
        ? [lat, lng]
        : initialCenter ?? DEFAULT_MAP_CENTER;

      const map = createMap(ref.current, {
        center,
        zoom: lat !== null ? 15 : 10,
        theme: mapTheme,
        interactive: true,
        scrollZoom: panEnabled,
      });
      setPickerBehaviors(map, panEnabled);

      const runReverse = async (coords: [number, number]) => {
        const gen = ++reverseGenRef.current;
        const { onPick: pick, onAddressChange: setAddr, onGeocodingChange: setGeo } = callbacksRef.current;
        setGeo?.(true);
        try {
          const a = await reverseGeocode(coords[0], coords[1]);
          if (destroyed || gen !== reverseGenRef.current) return;
          setAddr(a);
          pick(coords[0], coords[1], a);
        } finally {
          if (!destroyed && gen === reverseGenRef.current) setGeo?.(false);
        }
      };

      const scheduleReverse = (coords: [number, number]) => {
        clearReverseTimer();
        reverseTimerRef.current = setTimeout(() => {
          reverseTimerRef.current = null;
          void runReverse(coords);
        }, REVERSE_DEBOUNCE_MS);
      };

      const setCenterIfNeeded = (coords: [number, number], z = 15) => {
        const current = map.getCenter();
        const zoom = map.getZoom();
        if (almostSame([current.lat, current.lng], coords) && Math.abs(zoom - z) < 0.5) return;
        map.easeTo({ center: [coords[1], coords[0]], zoom: z, duration: 300 });
      };

      const ensureMarker = (coords: [number, number]) => {
        if (markerRef.current) {
          const cur = markerRef.current.getLngLat();
          if (!almostSame([cur.lat, cur.lng], coords)) {
            markerRef.current.setLngLat([coords[1], coords[0]]);
          }
          return markerRef.current;
        }
        const marker = new Marker({
          element: createDotMarkerElement('#ef4444', 16),
          draggable: true,
        })
          .setLngLat([coords[1], coords[0]])
          .addTo(map);
        marker.on('dragend', () => {
          const p = marker.getLngLat();
          scheduleReverse([p.lat, p.lng]);
        });
        markerRef.current = marker;
        return marker;
      };

      const placeOrMove = (coords: [number, number], doGeocode: boolean) => {
        const { onPick: pick, address: addr } = callbacksRef.current;
        ensureMarker(coords);
        setCenterIfNeeded(coords, 15);
        if (doGeocode) {
          clearReverseTimer();
          void runReverse(coords);
        } else {
          pick(coords[0], coords[1], addr);
        }
      };

      if (lat !== null && lng !== null) placeOrMove([lat, lng], false);

      map.on('click', (e) => {
        placeOrMove([e.lngLat.lat, e.lngLat.lng], true);
      });

      mapRef.current = map;
      appliedThemeRef.current = mapTheme;
      map.once('load', () => {
        if (!destroyed) setReady(true);
        map.resize();
      });
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Не удалось инициализировать карту');
    }

    return () => {
      destroyed = true;
      clearReverseTimer();
      reverseGenRef.current += 1;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panEnabled]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (appliedThemeRef.current === mapTheme) return;
    appliedThemeRef.current = mapTheme;
    applyMapTheme(mapRef.current, mapTheme);
  }, [mapTheme, ready]);

  useEffect(() => {
    if (!ready || !mapRef.current || lat === null || lng === null) return;
    const map = mapRef.current;
    const coords: [number, number] = [lat, lng];

    if (markerRef.current) {
      const cur = markerRef.current.getLngLat();
      if (!almostSame([cur.lat, cur.lng], coords)) {
        markerRef.current.setLngLat([coords[1], coords[0]]);
      }
    } else {
      const marker = new Marker({
        element: createDotMarkerElement('#ef4444', 16),
        draggable: true,
      })
        .setLngLat([coords[1], coords[0]])
        .addTo(map);
      marker.on('dragend', () => {
        const p = marker.getLngLat();
        if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
        reverseTimerRef.current = setTimeout(async () => {
          reverseTimerRef.current = null;
          const gen = ++reverseGenRef.current;
          const { onPick: pick, onAddressChange: setAddr, onGeocodingChange: setGeo } = callbacksRef.current;
          setGeo?.(true);
          try {
            const a = await reverseGeocode(p.lat, p.lng);
            if (gen !== reverseGenRef.current) return;
            setAddr(a);
            pick(p.lat, p.lng, a);
          } finally {
            if (gen === reverseGenRef.current) setGeo?.(false);
          }
        }, REVERSE_DEBOUNCE_MS);
      });
      markerRef.current = marker;
    }

    const current = map.getCenter();
    const z = map.getZoom();
    if (!almostSame([current.lat, current.lng], coords) || Math.abs(z - 15) >= 0.5) {
      map.easeTo({ center: [coords[1], coords[0]], zoom: 15, duration: 300 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, ready]);

  useEffect(() => {
    if (!ready || !mapRef.current || !ref.current) return;
    const map = mapRef.current;
    const fit = () => map.resize();
    fit();
    const observer = new ResizeObserver(() => fit());
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ready, panEnabled]);

  if (loadErr) return <div className={styles.errorBox}>{loadErr}</div>;

  return (
    <div
      ref={ref}
      className={`${className ?? styles.pickerMap} ${mapDarkClass(mapTheme, styles)}`}
    />
  );
}
