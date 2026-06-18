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
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const { theme } = useThemeStore();

  callbacksRef.current = { onPick, onAddressChange, onGeocodingChange, address };

  useEffect(() => {
    let destroyed = false;
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

      async function placeOrMove(coords: [number, number], doGeocode: boolean) {
        const { onPick: pick, onAddressChange: setAddr, onGeocodingChange: setGeo, address: addr } = callbacksRef.current;

        if (markerRef.current) {
          markerRef.current.geometry.setCoordinates(coords);
        } else {
          const pm = new ymaps.Placemark(coords, {}, { draggable: true, preset: 'islands#redDotIcon' });
          pm.events.add('dragend', async () => {
            const c = pm.geometry.getCoordinates() as [number, number];
            setGeo?.(true);
            const a = await reverseGeocode(c[0], c[1]);
            setGeo?.(false);
            setAddr(a);
            pick(c[0], c[1], a);
          });
          map.geoObjects.add(pm);
          markerRef.current = pm;
        }
        map.setCenter(coords, 15, { duration: 300 });
        if (doGeocode) {
          setGeo?.(true);
          const a = await reverseGeocode(coords[0], coords[1]);
          setGeo?.(false);
          setAddr(a);
          pick(coords[0], coords[1], a);
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
    const { onPick: pick, onAddressChange: setAddr, onGeocodingChange: setGeo, address: addr } = callbacksRef.current;

    if (markerRef.current) {
      markerRef.current.geometry.setCoordinates([lat, lng]);
    } else {
      const pm = new ymaps.Placemark([lat, lng], {}, { draggable: true, preset: 'islands#redDotIcon' });
      pm.events.add('dragend', async () => {
        const c = pm.geometry.getCoordinates() as [number, number];
        setGeo?.(true);
        const a = await reverseGeocode(c[0], c[1]);
        setGeo?.(false);
        setAddr(a);
        pick(c[0], c[1], a);
      });
      mapRef.current.geoObjects.add(pm);
      markerRef.current = pm;
    }
    mapRef.current.setCenter([lat, lng], 15, { duration: 300 });
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

  if (loadErr) return <div className={styles.errorBox}>⚠️ {loadErr}</div>;

  const darkFilter = 'invert(0.9) hue-rotate(180deg) saturate(0.75) brightness(0.9)';

  return (
    <div
      ref={ref}
      className={className ?? styles.pickerMap}
      style={theme === 'dark' ? { filter: darkFilter } : undefined}
    />
  );
}
