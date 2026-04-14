// features/event-map/EventMap.tsx
// Интерактивная карта мероприятий на Leaflet (CDN, без npm-пакета)
// Маркеры кластеризованы по типу. Клик открывает EventModal.

import { useEffect, useRef } from 'react';
import type { IEvent } from '@/entities/event';
import styles from './EventMap.module.css';

interface EventMapProps {
  events: IEvent[];
  onMarkerClick: (event: IEvent) => void;
  /** Начальный центр карты [lat, lng] */
  center?: [number, number];
  zoom?: number;
}

// Категория → цвет маркера
function categoryColor(namePath?: string | null): string {
  if (!namePath) return '#6366f1';
  if (namePath.startsWith('music'))  return '#8b5cf6';
  if (namePath.startsWith('sport'))  return '#10b981';
  if (namePath.startsWith('art'))    return '#f59e0b';
  if (namePath.startsWith('food'))   return '#f97316';
  return '#6366f1';
}

// SVG-маркер в виде булавки
function markerSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.75 14 22 14 22S28 23.75 28 14C28 6.27 21.73 0 14 0z"
      fill="${color}" opacity="0.92"/>
    <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
  </svg>`;
}

declare global {
  interface Window {
    L: any; // Leaflet глобальный объект
  }
}

// Загружаем Leaflet один раз
let leafletLoaded = false;
function loadLeaflet(): Promise<void> {
  if (leafletLoaded || window.L) { leafletLoaded = true; return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    // CSS
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(link);
    // JS
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    script.onload = () => { leafletLoaded = true; resolve(); };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export function EventMap({ events, onMarkerClick, center = [55.7558, 37.6173], zoom = 12 }: EventMapProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<any>(null);
  const markersRef    = useRef<any[]>([]);
  const isDarkRef     = useRef(document.body.classList.contains('light-theme') === false);

  // Инициализация карты
  useEffect(() => {
    loadLeaflet().then(() => {
      const L = window.L;
      if (!containerRef.current || mapRef.current) return;

      const isDark = !document.body.classList.contains('light-theme');
      const tileUrl = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

      const map = L.map(containerRef.current, {
        center,
        zoom,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer(tileUrl, {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Обновляем маркеры при изменении events
  useEffect(() => {
    const L = window.L;
    if (!mapRef.current || !L) return;

    // Убираем старые маркеры
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    events.forEach(event => {
      if (event.latitude == null || event.longitude == null) return;

      const color = categoryColor(event.eventType?.eventCategory?.namePath);
      const svg   = markerSvg(color);

      const icon = L.divIcon({
        html: svg,
        className: '',
        iconSize:   [28, 36],
        iconAnchor: [14, 36],
        popupAnchor:[0, -36],
      });

      const marker = L.marker([event.latitude, event.longitude], { icon })
        .addTo(mapRef.current)
        .on('click', () => onMarkerClick(event));

      // Тултип с названием
      marker.bindTooltip(event.name, {
        permanent: false,
        direction: 'top',
        offset: [0, -30],
        className: 'elist-tooltip',
      });

      markersRef.current.push(marker);
    });
  }, [events, onMarkerClick]);

  return (
    <div className={styles.mapWrap}>
      <div ref={containerRef} className={styles.map} />
      {/* Стили тултипа — глобальные */}
      <style>{`
        .elist-tooltip {
          background: var(--surface, #1a1a1a);
          border: 1px solid var(--border, #2a2a2a);
          color: var(--text-primary, #e0e0e0);
          border-radius: 8px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 500;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          white-space: nowrap;
        }
        .elist-tooltip::before { display: none; }
        .leaflet-container { font-family: inherit; }
      `}</style>
    </div>
  );
}
