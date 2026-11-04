// features/event-map/YandexMap.tsx — просмотровая карта

import { useEffect, useRef, useState } from 'react';
import {
  loadYandexMaps,
  addCompactZoomControl,
  attachYandexCopyrightPointLink,
  disableMapPageScrollCapture,
} from '@/shared/lib/yandexMaps';
import { useThemeStore } from '@/app/store';
import styles from './YandexMap.module.css';

interface YandexMapProps { lat: number; lng: number; label?: string; zoom?: number; draggable?: boolean; }

const COORD_EPS = 1e-5;

function almostSame(a: [number, number], b: [number, number], eps = COORD_EPS): boolean {
  return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
}

export function YandexMap({ lat, lng, label, zoom = 15, draggable = true }: YandexMapProps) {
  const wrapRef  = useRef<HTMLDivElement>(null);
  const mapRef   = useRef<HTMLDivElement>(null);
  const mapInst  = useRef<any>(null);
  const placemarkRef = useRef<any>(null);
  const detachCopyrightRef = useRef<(() => void) | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const { theme } = useThemeStore();

  // Инстанс карты создаём один раз; смена draggable — редкий remount
  useEffect(() => {
    let destroyed = false;

    loadYandexMaps().then(() => {
      if (destroyed || !mapRef.current) return;
      const ymaps = (window as any).ymaps;
      const map = new ymaps.Map(mapRef.current, {
        center: [lat, lng], zoom,
        controls: [],
        type: 'yandex#map',
        behaviors: draggable ? ['default'] : [],
      }, { suppressMapOpenBlock: true, yandexMapDisablePoiInteractivity: true });
      addCompactZoomControl(map);
      if (!draggable) {
        disableMapPageScrollCapture(map);
      }
      const pm = new ymaps.Placemark(
        [lat, lng],
        { balloonContent: label ?? '' },
        { preset: 'islands#violetDotIcon' },
      );
      map.geoObjects.add(pm);
      mapInst.current = map;
      placemarkRef.current = pm;

      if (wrapRef.current) {
        detachCopyrightRef.current = attachYandexCopyrightPointLink(wrapRef.current, lat, lng, zoom);
      }
      setReady(true);
    }).catch(e => setError(e.message));

    return () => {
      destroyed = true;
      detachCopyrightRef.current?.();
      detachCopyrightRef.current = undefined;
      placemarkRef.current = null;
      mapInst.current?.destroy?.();
      mapInst.current = null;
      setReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggable]);

  // Обновляем центр / метку без destroy карты (меньше тайлов)
  useEffect(() => {
    if (!ready || !mapInst.current) return;
    const map = mapInst.current;
    const coords: [number, number] = [lat, lng];
    const current = map.getCenter() as [number, number];
    const z = map.getZoom() as number;
    if (!almostSame(current, coords) || Math.abs(z - zoom) >= 0.5) {
      map.setCenter(coords, zoom, { duration: 200 });
    }
    if (placemarkRef.current) {
      const pmCoords = placemarkRef.current.geometry.getCoordinates() as [number, number];
      if (!almostSame(pmCoords, coords)) {
        placemarkRef.current.geometry.setCoordinates(coords);
      }
      placemarkRef.current.properties.set('balloonContent', label ?? '');
    }
    detachCopyrightRef.current?.();
    if (wrapRef.current) {
      detachCopyrightRef.current = attachYandexCopyrightPointLink(wrapRef.current, lat, lng, zoom);
    }
  }, [lat, lng, zoom, label, ready]);

  if (error) return <div className={styles.errorBox}>{error}</div>;

  return (
    <div ref={wrapRef} className={styles.mapViewWrap}>
      <div
        ref={mapRef}
        className={styles.map}
        style={theme === 'dark' ? { filter: 'invert(0.9) hue-rotate(180deg) saturate(0.75) brightness(0.9)' } : undefined}
      />
    </div>
  );
}
