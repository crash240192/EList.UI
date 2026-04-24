// features/event-map/EventMap.tsx — главная карта (API 2.1)
// Балуны Яндекса полностью отключены — всё через React-компоненты.
// При совпадении координат показываем список мероприятий на точке.

import { useEffect, useRef, useState, useCallback } from 'react';
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

const DEFAULT_COLOR = '#6366f1';

/** Цвет по типам мероприятия: берём из category.color или дефолт */
function getEventColors(event: IEvent): string[] {
  const types = event.eventTypes ?? (event.eventType ? [event.eventType] : []);
  const colors = types
    .map(t => t.eventCategory?.color)
    .filter((c): c is string => !!c);
  return colors.length ? [...new Set(colors)] : [DEFAULT_COLOR];
}

/** Генерируем PNG через Canvas — цвета точные, без артефактов SVG */
function makeMarkerPng(colors: string[], count = 1): string {
  const size = 36;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d')!;
  const cx = size / 2; const cy = size / 2; const r = 14;

  // Белая окантовка
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  if (colors.length === 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.fillStyle = colors[0];
    ctx.fill();
  } else {
    const step = (2 * Math.PI) / colors.length;
    colors.forEach((color, i) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, i * step - Math.PI / 2, (i + 1) * step - Math.PI / 2);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  // Белый центр или счётчик
  if (count > 1) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 11px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(count), cx, cy + 1);
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  return c.toDataURL('image/png');
}

// Ключ для группировки по координатам (округляем до 5 знаков ~1м точность)
const coordKey = (lat: number, lng: number) =>
  `${lat.toFixed(5)},${lng.toFixed(5)}`;

export function EventMap({ events, onMarkerClick, center = [55.7558, 37.6173], zoom = 12 }: EventMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const clusterRef   = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Храним актуальный center в ref чтобы closure в обработчике всегда видела свежие координаты
  const centerRef = useRef(center);
  useEffect(() => { centerRef.current = center; }, [center]);

  // Центрирование по событию от кнопки лого или смены города в фильтрах
  useEffect(() => {
    const handler = (e: Event) => {
      if (!mapRef.current) return;
      const detail = (e as CustomEvent<{ lat?: number; lng?: number } | null>).detail;
      const target: [number, number] = (detail?.lat && detail?.lng)
        ? [detail.lat, detail.lng]
        : centerRef.current;
      // setCenter — правильный метод в Яндекс.Картах API 2.1
      mapRef.current.setCenter(target, 12, { checkZoomRange: true, duration: 500 });
    };
    window.addEventListener('elist:centerMap', handler);
    return () => window.removeEventListener('elist:centerMap', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { theme } = useThemeStore();

  // Состояние списка мероприятий на одной точке + позиция
  const [groupState, setGroupState] = useState<{ events: IEvent[]; x: number; y: number } | null>(null);

  const showGroup = useCallback((group: IEvent[], x: number, y: number) => {
    if (group.length === 1) {
      onMarkerClick(group[0]);
      return;
    }
    setGroupState({ events: group, x, y });
  }, [onMarkerClick]);

  useEffect(() => {
    let destroyed = false;
    loadYandexMaps().then(() => {
      if (destroyed || !containerRef.current) return;
      const ymaps = (window as any).ymaps;
      const map = new ymaps.Map(containerRef.current, {
        center, zoom,
        controls: ['zoomControl', 'typeSelector'],
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
    if (clusterRef.current) {
      mapRef.current.geoObjects.remove(clusterRef.current);
      clusterRef.current = null;
    }

    // Группируем мероприятия по координатам
    const groups = new Map<string, IEvent[]>();
    for (const ev of events) {
      if (ev.latitude == null || ev.longitude == null) continue;
      const key = coordKey(ev.latitude, ev.longitude);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ev);
    }

    const clusterer = new ymaps.Clusterer({
      gridSize: 60,
      clusterDisableClickZoom:   true,
      clusterOpenBalloonOnClick: false,
    });
    const marks: any[] = [];

    for (const [, group] of groups) {
      const first = group[0];
      const color = getEventColors(first);
      const pm = new ymaps.Placemark(
        [first.latitude!, first.longitude!],
        {},
        {
          iconLayout:         'default#image',
          iconImageHref:      makeMarkerPng(color, group.length),
          iconImageSize:      [36, 36],
          iconImageOffset:    [-18, -18],
          openBalloonOnClick: false,
        }
      );
      // Сохраняем группу на объекте для доступа из обработчика кластера
      (pm as any)._elistGroup = group;
      pm.events.add('click', (e: any) => {
        // Берём пиксельные координаты из события клика
        const pageX = e.get('pageX') as number;
        const pageY = e.get('pageY') as number;
        if (containerRef.current && pageX != null && pageY != null) {
          const rect = containerRef.current.getBoundingClientRect();
          showGroup(group, pageX - rect.left, pageY - rect.top);
        } else {
          showGroup(group, -1, -1);
        }
      });
      marks.push(pm);
    }

    clusterer.add(marks);

    clusterer.events.add('click', (e: any) => {
      const target = e.get('target');
      const placemarks: any[] = target.getGeoObjects?.() ?? [];
      const clusterEvents: IEvent[] = [];
      placemarks.forEach((pm: any) => {
        (pm._elistGroup ?? []).forEach((ev: IEvent) => clusterEvents.push(ev));
      });
      if (clusterEvents.length > 0) {
        const pageX = e.get('pageX') as number;
        const pageY = e.get('pageY') as number;
        if (containerRef.current && pageX != null && pageY != null) {
          const rect = containerRef.current.getBoundingClientRect();
          showGroup(clusterEvents, pageX - rect.left, pageY - rect.top);
        } else {
          showGroup(clusterEvents, -1, -1);
        }
      }
    });

    mapRef.current.geoObjects.add(clusterer);
    clusterRef.current = clusterer;
  }, [events, showGroup, ready]);

  if (error) return (
    <div className={styles.errorBox} style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      ⚠️ {error}
    </div>
  );

  return (
    <div className={styles.eventsMapWrap}>
      <div
        ref={containerRef}
        className={styles.eventsMap}
        style={theme === 'dark' ? { filter: 'invert(0.9) hue-rotate(180deg) saturate(0.75) brightness(0.9)' } : undefined}
      />

      {/* Список мероприятий на одной точке */}
      {groupState && (
        <PointGroupModal
          events={groupState.events}
          anchorX={groupState.x}
          anchorY={groupState.y}
          onSelect={ev => { setGroupState(null); onMarkerClick(ev); }}
          onClose={() => setGroupState(null)}
        />
      )}
    </div>
  );
}

// ---- Модальный список мероприятий в одной точке ----

function PointGroupModal({ events, anchorX, anchorY, onSelect, onClose }: {
  events: IEvent[];
  anchorX: number;
  anchorY: number;
  onSelect: (ev: IEvent) => void;
  onClose: () => void;
}) {
  const MODAL_W = 300;
  const MODAL_ESTIMATED_H = Math.min(events.length * 52 + 48, 288);
  const GAP = 12; // отступ от маркера

  const positioned = anchorX >= 0 && anchorY >= 0;

  // Вычисляем left/top так чтобы модал не уходил за края
  // left: центрируем по X, но не выходим за [0, containerW - MODAL_W]
  const rawLeft = anchorX - MODAL_W / 2;
  const left    = Math.max(8, rawLeft);                         // не за левый край
  // top: показываем над точкой, но не за верхний край
  const rawTop  = anchorY - MODAL_ESTIMATED_H - GAP;
  const top     = rawTop < 8
    ? anchorY + GAP + 14   // если не влезает сверху — показываем снизу
    : rawTop;

  const style: React.CSSProperties = positioned
    ? { position: 'absolute', left, top, width: MODAL_W }
    : { position: 'absolute', bottom: 24, left: '50%', marginLeft: -MODAL_W / 2, width: MODAL_W };

  const tailAbove = positioned && rawTop >= 8; // хвостик снизу модала (когда модал над точкой)

  return (
    <>
      <div className={styles.groupBackdrop} onClick={onClose} />
      <div className={styles.groupModal} style={style}>
        <div className={styles.groupHeader}>
          <span className={styles.groupTitle}>
            {events.length} мероприятия в этой точке
          </span>
          <button className={styles.groupClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.groupList}>
          {events.map(ev => {
            const cost  = ev.parameters?.cost ?? 0;
            const colors = getEventColors(ev); const color = colors[0];
            return (
              <button key={ev.id} className={styles.groupItem} onClick={() => onSelect(ev)}>
                <div className={styles.groupDot} style={{ background: color }} />
                <div className={styles.groupItemInfo}>
                  <span className={styles.groupItemName}>{ev.name}</span>
                  <span className={styles.groupItemMeta}>
                    {ev.eventType?.name && <span>{ev.eventType.name}</span>}
                    <span>{cost === 0 ? 'Бесплатно' : `${cost.toLocaleString('ru-RU')} ₽`}</span>
                  </span>
                </div>
                <span className={styles.groupArrow}>›</span>
              </button>
            );
          })}
        </div>
        {/* Хвостик — снизу если модал над точкой, сверху если под */}
        {positioned && (
          <div
            className={styles.groupTail}
            style={tailAbove
              ? { bottom: -7, top: 'auto', left: Math.max(12, Math.min(MODAL_W - 26, anchorX - left - 7)) }
              : { top: -7, bottom: 'auto', left: Math.max(12, Math.min(MODAL_W - 26, anchorX - left - 7)), transform: 'rotate(180deg)' }
            }
          />
        )}
      </div>
    </>
  );
}
