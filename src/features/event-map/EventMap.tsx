// features/event-map/EventMap.tsx — главная карта (API 2.1)

import { useEffect, useRef, useState } from 'react';
import type { IEvent } from '@/entities/event';
import { loadYandexMaps } from '@/shared/lib/yandexMaps';
import { useThemeStore } from '@/app/store';
import styles from './YandexMap.module.css';

interface EventMapProps {
  events: IEvent[];
  onMarkerClick: (event: IEvent) => void;
  center?: [number, number];
  zoom?: number;
}

const CAT_COLORS: Record<string, string> = {
  music: '#8b5cf6', sport: '#10b981', art: '#f59e0b', food: '#f97316',
};
const getColor = (p?: string | null) => {
  for (const [k, c] of Object.entries(CAT_COLORS)) if (p?.startsWith(k)) return c;
  return '#6366f1';
};
const svgIcon = (color: string) =>
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">` +
    `<circle cx="12" cy="12" r="10" fill="${color}" opacity=".9"/>` +
    `<circle cx="12" cy="12" r="5" fill="white" opacity=".8"/></svg>`
  );

export function EventMap({ events, onMarkerClick, center = [55.7558, 37.6173], zoom = 12 }: EventMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const clusterRef   = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const { theme } = useThemeStore();

  useEffect(() => {
    let destroyed = false;
    loadYandexMaps().then(() => {
      if (destroyed || !containerRef.current) return;
      const ymaps = (window as any).ymaps;
      const map = new ymaps.Map(containerRef.current, {
        center, zoom,
        controls: ['zoomControl', 'typeSelector'],
        // Только стандартные типы API 2.1
        type: 'yandex#map',
      });
      mapRef.current = map;
      setReady(true);
    }).catch(e => setError(e.message));
    return () => {
      destroyed = true;
      mapRef.current?.destroy?.();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Маркеры
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const ymaps = (window as any).ymaps;
    if (clusterRef.current) { mapRef.current.geoObjects.remove(clusterRef.current); clusterRef.current = null; }
    const clusterer = new ymaps.Clusterer({ gridSize: 60 });
    const marks = events
      .filter(ev => ev.latitude != null && ev.longitude != null)
      .map(ev => {
        const pm = new ymaps.Placemark(
          [ev.latitude!, ev.longitude!],
          { hintContent: ev.name, balloonContent: `<b>${ev.name}</b>` },
          { iconLayout: 'default#image', iconImageHref: svgIcon(getColor(ev.eventType?.eventCategory?.namePath)), iconImageSize: [24, 24], iconImageOffset: [-12, -12] }
        );
        pm.events.add('click', () => onMarkerClick(ev));
        return pm;
      });
    clusterer.add(marks);
    mapRef.current.geoObjects.add(clusterer);
    clusterRef.current = clusterer;
  }, [events, onMarkerClick, ready]);

  if (error) return (
    <div className={styles.errorBox} style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      ⚠️ {error}
    </div>
  );

  return (
    <div className={styles.eventsMapWrap}>
      {/* Тёмная тема через CSS-фильтр — yandex#dark не существует в API 2.1 */}
      <div
        ref={containerRef}
        className={styles.eventsMap}
        style={theme === 'dark' ? { filter: 'invert(0.9) hue-rotate(180deg) saturate(0.75) brightness(0.9)' } : undefined}
      />
    </div>
  );
}
