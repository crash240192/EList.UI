// features/event-map/YandexMap.tsx — просмотровая карта

import { useEffect, useRef, useState } from 'react';
import { loadYandexMaps, addCompactZoomControl, attachYandexCopyrightPointLink } from '@/shared/lib/yandexMaps';
import { useThemeStore } from '@/app/store';
import styles from './YandexMap.module.css';

interface YandexMapProps { lat: number; lng: number; label?: string; zoom?: number; draggable?: boolean; }

export function YandexMap({ lat, lng, label, zoom = 15, draggable = true }: YandexMapProps) {
  const wrapRef  = useRef<HTMLDivElement>(null);
  const mapRef   = useRef<HTMLDivElement>(null);
  const mapInst  = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useThemeStore();

  useEffect(() => {
    let destroyed = false;
    let detachCopyright: (() => void) | undefined;

    loadYandexMaps().then(() => {
      if (destroyed || !mapRef.current) return;
      const ymaps = (window as any).ymaps;
      const map = new ymaps.Map(mapRef.current, {
        center: [lat, lng], zoom,
        controls: [],
        type: 'yandex#map',
        behaviors: draggable ? ['default'] : ['scrollZoom'],
      }, { suppressMapOpenBlock: true, yandexMapDisablePoiInteractivity: true });
      addCompactZoomControl(map);
      if (!draggable) {
        map.behaviors.disable('drag');
        map.behaviors.disable('multiTouch');
      }
      map.geoObjects.add(
        new ymaps.Placemark([lat, lng], { balloonContent: label ?? '' }, { preset: 'islands#violetDotIcon' }),
      );
      mapInst.current = map;

      if (wrapRef.current) {
        detachCopyright = attachYandexCopyrightPointLink(wrapRef.current, lat, lng, zoom);
      }
    }).catch(e => setError(e.message));

    return () => {
      destroyed = true;
      detachCopyright?.();
      mapInst.current?.destroy?.();
      mapInst.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, zoom, label, draggable]);

  if (error) return <div className={styles.errorBox}>⚠️ {error}</div>;

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
