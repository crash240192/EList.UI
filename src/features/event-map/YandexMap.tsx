// features/event-map/YandexMap.tsx — просмотровая карта (API 2.1)

import { useEffect, useRef, useState } from 'react';
import { loadYandexMaps } from '@/shared/lib/yandexMaps';
import styles from './YandexMap.module.css';

interface YandexMapProps {
  lat: number;
  lng: number;
  label?: string;
  zoom?: number;
}

export function YandexMap({ lat, lng, label, zoom = 15 }: YandexMapProps) {
  const ref   = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let destroyed = false;
    loadYandexMaps()
      .then(() => {
        if (destroyed || !ref.current) return;
        const ymaps = (window as any).ymaps;

        const map = new ymaps.Map(ref.current, {
          center: [lat, lng],
          zoom,
          controls: ['zoomControl'],
        });

        map.geoObjects.add(
          new ymaps.Placemark([lat, lng], { balloonContent: label ?? '' }, {
            preset: 'islands#violetDotIcon',
          })
        );

        mapRef.current = map;
      })
      .catch(e => setError(e.message));

    return () => {
      destroyed = true;
      mapRef.current?.destroy?.();
      mapRef.current = null;
    };
  }, [lat, lng, zoom, label]);

  if (error) return <div className={styles.errorBox}>⚠️ {error}</div>;
  return <div ref={ref} className={styles.map} />;
}
