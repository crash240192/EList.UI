// features/event-map/EventMap.tsx — главная карта мероприятий (API 2.1)

import { useEffect, useRef, useState } from 'react';
import type { IEvent } from '@/entities/event';
import { loadYandexMaps } from '@/shared/lib/yandexMaps';
import styles from './YandexMap.module.css';

interface EventMapProps {
  events: IEvent[];
  onMarkerClick: (event: IEvent) => void;
  center?: [number, number]; // [lat, lng]
  zoom?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  music:  '#8b5cf6',
  sport:  '#10b981',
  art:    '#f59e0b',
  food:   '#f97316',
};

function getColor(namePath?: string | null) {
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (namePath?.startsWith(key)) return color;
  }
  return '#6366f1';
}

export function EventMap({
  events, onMarkerClick,
  center = [55.7558, 37.6173], zoom = 12,
}: EventMapProps) {
  const ref        = useRef<HTMLDivElement>(null);
  const mapRef     = useRef<any>(null);
  const clusterRef = useRef<any>(null);
  const [error, setError]  = useState<string | null>(null);
  const [ready, setReady]  = useState(false);

  useEffect(() => {
    let destroyed = false;
    loadYandexMaps()
      .then(() => {
        if (destroyed || !ref.current) return;
        const ymaps = (window as any).ymaps;

        const map = new ymaps.Map(ref.current, {
          center,
          zoom,
          controls: ['zoomControl', 'typeSelector'],
        });

        mapRef.current = map;
        setReady(true);
      })
      .catch(e => setError(e.message));

    return () => {
      destroyed = true;
      mapRef.current?.destroy?.();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Обновляем маркеры при изменении events
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const ymaps = (window as any).ymaps;

    // Удаляем старый кластер
    if (clusterRef.current) {
      mapRef.current.geoObjects.remove(clusterRef.current);
      clusterRef.current = null;
    }

    // Кластеризатор — объединяет близкие маркеры
    const clusterer = new ymaps.Clusterer({ clusterDisableClickZoom: false, gridSize: 60 });

    const placemarks = events
      .filter(ev => ev.latitude != null && ev.longitude != null)
      .map(ev => {
        const color  = getColor(ev.eventType?.eventCategory?.namePath);
        const cost   = ev.parameters?.cost ?? 0;
        const pm = new ymaps.Placemark(
          [ev.latitude!, ev.longitude!],
          {
            balloonContent: `<b>${ev.name}</b><br>${cost === 0 ? 'Бесплатно' : cost + ' ₽'}`,
            hintContent:    ev.name,
          },
          {
            // Кастомная иконка: цветной кружок
            iconLayout:     'default#image',
            iconImageHref:  svgIcon(color),
            iconImageSize:  [24, 24],
            iconImageOffset:[-12, -12],
          }
        );
        pm.events.add('click', () => onMarkerClick(ev));
        return pm;
      });

    clusterer.add(placemarks);
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
      <div ref={ref} className={styles.eventsMap} />
    </div>
  );
}

// SVG-иконка маркера в виде кружка
function svgIcon(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="${color}" opacity="0.9"/>
    <circle cx="12" cy="12" r="5" fill="white" opacity="0.8"/>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
