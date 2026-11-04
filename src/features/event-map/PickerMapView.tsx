// features/event-map/PickerMapView.tsx — карта выбора точки (компактная и в модалке)

import { useEffect, useRef, useState } from 'react';
import {
  loadYandexMaps,
  reverseGeocode,
  YMAP_DISABLE_POI_OPTIONS,
  addCompactZoomControl,
  configurePickerMapBehaviors,
  configureExpandedPickerMapBehaviors,
} from '@/shared/lib/yandexMaps';
import { useThemeStore } from '@/app/store';
import styles from './YandexMap.module.css';

interface PickerMapViewProps {
  lat: number | null;
  lng: number | null;
  address: string;
  initialCenter?: [number, number];
  /** Разрешить сдвиг карты зажатием (модалка «Развернуть») */
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
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const callbacksRef = useRef({ onPick, onAddressChange, onGeocodingChange, address });
  const reverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reverseGenRef = useRef(0);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const { theme } = useThemeStore();

  callbacksRef.current = { onPick, onAddressChange, onGeocodingChange, address };

  useEffect(() => {
    let destroyed = false;

    const clearReverseTimer = () => {
      if (reverseTimerRef.current) {
        clearTimeout(reverseTimerRef.current);
        reverseTimerRef.current = null;
      }
    };

    loadYandexMaps().then(() => {
      if (destroyed || !ref.current) return;
      const ymaps = (window as any).ymaps;
      const center: [number, number] = lat !== null && lng !== null
        ? [lat, lng]
        : initialCenter ?? [55.7558, 37.6173];

      const map = new ymaps.Map(ref.current, {
        center,
        zoom: lat !== null ? 15 : 10,
        controls: [],
        type: 'yandex#map',
      }, YMAP_DISABLE_POI_OPTIONS);
      addCompactZoomControl(map);
      if (panEnabled) {
        configureExpandedPickerMapBehaviors(map);
      } else {
        configurePickerMapBehaviors(map);
      }

      const setCenterIfNeeded = (coords: [number, number], zoom = 15) => {
        const current = map.getCenter() as [number, number];
        const z = map.getZoom() as number;
        if (almostSame(current, coords) && Math.abs(z - zoom) < 0.5) return;
        map.setCenter(coords, zoom, { duration: 300 });
      };

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

      function ensureMarker(coords: [number, number]) {
        if (markerRef.current) {
          const cur = markerRef.current.geometry.getCoordinates() as [number, number];
          if (!almostSame(cur, coords)) {
            markerRef.current.geometry.setCoordinates(coords);
          }
          return;
        }
        const pm = new ymaps.Placemark(coords, {}, { draggable: true, preset: 'islands#redDotIcon' });
        pm.events.add('dragend', () => {
          const c = pm.geometry.getCoordinates() as [number, number];
          scheduleReverse(c);
        });
        map.geoObjects.add(pm);
        markerRef.current = pm;
      }

      async function placeOrMove(coords: [number, number], doGeocode: boolean) {
        const { onPick: pick, address: addr } = callbacksRef.current;
        ensureMarker(coords);
        setCenterIfNeeded(coords, 15);
        if (doGeocode) {
          // Клик — сразу; dragend идёт через scheduleReverse
          clearReverseTimer();
          void runReverse(coords);
        } else {
          pick(coords[0], coords[1], addr);
        }
      }

      if (lat !== null && lng !== null) placeOrMove([lat, lng], false);

      map.events.add('click', (e: any) => placeOrMove(e.get('coords') as [number, number], true));

      mapRef.current = map;
      setReady(true);
    }).catch(e => setLoadErr(e.message));

    return () => {
      destroyed = true;
      clearReverseTimer();
      reverseGenRef.current += 1;
      markerRef.current = null;
      mapRef.current?.destroy?.();
      mapRef.current = null;
      setReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panEnabled]);

  useEffect(() => {
    if (!ready || !mapRef.current || lat === null || lng === null) return;
    const ymaps = (window as any).ymaps;
    const coords: [number, number] = [lat, lng];

    if (markerRef.current) {
      const cur = markerRef.current.geometry.getCoordinates() as [number, number];
      if (!almostSame(cur, coords)) {
        markerRef.current.geometry.setCoordinates(coords);
      }
    } else {
      const pm = new ymaps.Placemark(coords, {}, { draggable: true, preset: 'islands#redDotIcon' });
      pm.events.add('dragend', () => {
        const c = pm.geometry.getCoordinates() as [number, number];
        if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
        reverseTimerRef.current = setTimeout(async () => {
          reverseTimerRef.current = null;
          const gen = ++reverseGenRef.current;
          const { onPick: p, onAddressChange: setAddr, onGeocodingChange: setGeo } = callbacksRef.current;
          setGeo?.(true);
          try {
            const a = await reverseGeocode(c[0], c[1]);
            if (gen !== reverseGenRef.current) return;
            setAddr(a);
            p(c[0], c[1], a);
          } finally {
            if (gen === reverseGenRef.current) setGeo?.(false);
          }
        }, REVERSE_DEBOUNCE_MS);
      });
      mapRef.current.geoObjects.add(pm);
      markerRef.current = pm;
    }

    const current = mapRef.current.getCenter() as [number, number];
    const z = mapRef.current.getZoom() as number;
    if (!almostSame(current, coords) || Math.abs(z - 15) >= 0.5) {
      mapRef.current.setCenter(coords, 15, { duration: 300 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, ready]);

  useEffect(() => {
    if (!ready || !mapRef.current || !ref.current) return;
    const map = mapRef.current;
    const fit = () => {
      try {
        map.container.fitToViewport();
      } catch {
        /* ignore */
      }
    };
    fit();
    const observer = new ResizeObserver(() => fit());
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ready, panEnabled]);

  if (loadErr) return <div className={styles.errorBox}>{loadErr}</div>;

  const darkFilter = 'invert(1) hue-rotate(180deg)';

  return (
    <div
      ref={ref}
      className={className ?? styles.pickerMap}
      style={theme === 'dark' ? { filter: darkFilter } : undefined}
    />
  );
}
