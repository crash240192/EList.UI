// features/event-map/EventMap.tsx — главная карта (API 2.1)
// Балуны Яндекса полностью отключены — всё через React-компоненты.
// При совпадении координат показываем список мероприятий на точке.

import { useEffect, useRef, useState, useCallback } from 'react';
import type { IEventSearchShortItem } from '@/entities/event';
import { loadYandexMaps } from '@/shared/lib/yandexMaps';
import { useThemeStore } from '@/app/store';
import styles from './YandexMap.module.css';

export interface MapSearchArea {
  lat: number;
  lng: number;
  /** Радиус в метрах — по видимой области карты (центр → дальний угол) */
  radiusM: number;
}

interface EventMapProps {
  events: IEventSearchShortItem[];
  /** По id подгружается полное событие на стороне страницы */
  onMarkerClick: (eventId: string) => void;
  center?: [number, number];
  zoom?: number;
  onCenterChange?: (center: [number, number]) => void;
  onZoomChange?: (zoom: number) => void;
  /** Центр карты + радиус по текущему виду (пан/зум) — для поиска мероприятий */
  onSearchAreaChange?: (area: MapSearchArea) => void;
  /** Задержка перед вызовом после панорамирования/зума, мс */
  searchAreaDebounceMs?: number;
}

const DEFAULT_COLOR = '#6366f1';

/** Цвета маркера из ответа search/short */
function markerColors(item: IEventSearchShortItem): string[] {
  const c = item.colors?.filter(Boolean) ?? [];
  return c.length ? [...new Set(c)] : [DEFAULT_COLOR];
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

export function EventMap({
  events,
  onMarkerClick,
  center = [55.7558, 37.6173],
  zoom = 12,
  onCenterChange,
  onZoomChange,
  onSearchAreaChange,
  searchAreaDebounceMs = 400,
}: EventMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const clusterRef   = useRef<any>(null);
  const onSearchAreaRef = useRef(onSearchAreaChange);
  useEffect(() => { onSearchAreaRef.current = onSearchAreaChange; }, [onSearchAreaChange]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Контекстное меню «Искать здесь»
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; lat: number; lng: number } | null>(null);

  // Храним актуальный center в ref
  const centerRef = useRef(center);
  useEffect(() => { centerRef.current = center; }, [center]);

  // Центрирование по событию
  useEffect(() => {
    const handler = (e: Event) => {
      if (!mapRef.current) return;
      const detail = (e as CustomEvent<{ lat?: number; lng?: number } | null>).detail;
      const target: [number, number] = (detail?.lat && detail?.lng)
        ? [detail.lat, detail.lng]
        : centerRef.current;
      mapRef.current.setCenter(target, 12, { checkZoomRange: true, duration: 500 });
    };
    window.addEventListener('elist:centerMap', handler);
    return () => window.removeEventListener('elist:centerMap', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Закрытие контекстного меню при клике вне
  useEffect(() => {
    if (!ctxMenu) return;
    const fn = () => setCtxMenu(null);
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [ctxMenu]);

  const { theme } = useThemeStore();

  // Список мероприятий на одной точке
  const [groupState, setGroupState] = useState<{ events: IEventSearchShortItem[]; x: number; y: number } | null>(null);

  const showGroup = useCallback((group: IEventSearchShortItem[], x: number, y: number) => {
    if (group.length === 1) {
      onMarkerClick(group[0].id);
      return;
    }
    setGroupState({ events: group, x, y });
  }, [onMarkerClick]);

  // Применяем «Искать здесь» — пишем координаты и радиус в стор через событие
  const handleSearchHere = (lat: number, lng: number, radius: number) => {
    setCtxMenu(null);
    window.dispatchEvent(new CustomEvent('elist:searchHere', { detail: { lat, lng, radius } }));
  };

  useEffect(() => {
    let destroyed = false;
    const el = containerRef.current; // захватываем ДО async
    let handlePointerDown: ((e: PointerEvent) => void) | null = null;
    let handlePointerUp:   (() => void) | null = null;
    let handlePointerMove: ((e: PointerEvent) => void) | null = null;
    let searchAreaTimer: ReturnType<typeof setTimeout> | null = null;

    loadYandexMaps().then(() => {
      if (destroyed || !el) return;
      const ymaps = (window as any).ymaps;
      const map = new ymaps.Map(el, {
        center, zoom,
        controls: ['zoomControl', 'typeSelector'],
        type: 'yandex#map',
      });
      mapRef.current = map;

      const emitSearchArea = () => {
        const cb = onSearchAreaRef.current;
        if (!cb || !mapRef.current) return;
        const ymapsLocal = (window as any).ymaps;
        const m = mapRef.current;
        const c = m.getCenter() as [number, number];
        const bounds = m.getBounds?.() as [[number, number], [number, number]] | undefined;
        if (!bounds?.[0] || !bounds?.[1]) return;
        const sw = bounds[0];
        const ne = bounds[1];
        const corners: [number, number][] = [
          [sw[0], sw[1]],
          [sw[0], ne[1]],
          [ne[0], sw[1]],
          [ne[0], ne[1]],
        ];
        let radiusM = 0;
        for (const q of corners) {
          const d = ymapsLocal.coordSystem.geo.getDistance(c, q);
          if (d > radiusM) radiusM = d;
        }
        radiusM = Math.round(Math.max(200, Math.min(radiusM, 5_000_000)));
        cb({ lat: c[0], lng: c[1], radiusM });
      };

      const scheduleSearchArea = () => {
        if (!onSearchAreaRef.current) return;
        if (searchAreaTimer) clearTimeout(searchAreaTimer);
        searchAreaTimer = setTimeout(() => {
          searchAreaTimer = null;
          emitSearchArea();
        }, searchAreaDebounceMs);
      };

      // Сохраняем центр и зум при перемещении; область поиска — отдельно (debounce)
      map.events.add('actionend', () => {
        const c = map.getCenter() as [number, number];
        const z = map.getZoom() as number;
        centerRef.current = c;
        onCenterChange?.(c);
        onZoomChange?.(z);
        scheduleSearchArea();
      });

      // Первичная синхронизация области поиска с видимой картой
      requestAnimationFrame(() => scheduleSearchArea());

      // Правый клик — контекстное меню (десктоп)
      map.events.add('contextmenu', (e: any) => {
        const coords = e.get('coords');
        const pixel  = e.get('domEvent').originalEvent;
        if (!coords || !el) return;
        const rect = el.getBoundingClientRect();
        setCtxMenu({
          x: pixel.clientX - rect.left,
          y: pixel.clientY - rect.top,
          lat: coords[0], lng: coords[1],
        });
        setGroupState(null);
      });

      // Долгое нажатие — pointerdown работает и для touch и для mouse
      let longPressTimer: ReturnType<typeof setTimeout> | null = null;
      let longPressMoved = false;
      let longPressX = 0, longPressY = 0;

      handlePointerDown = (e: PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        longPressMoved = false;
        longPressX = e.clientX;
        longPressY = e.clientY;

        longPressTimer = setTimeout(() => {
          if (longPressMoved || !el) return;
          const rect = el.getBoundingClientRect();
          const x = longPressX - rect.left;
          const y = longPressY - rect.top;
          try {
            const coords = map.converter.pageToGeo([longPressX, longPressY]);
            if (!coords) return;
            setCtxMenu({ x, y, lat: coords[0], lng: coords[1] });
            setGroupState(null);
            if (navigator.vibrate) navigator.vibrate(40);
          } catch { /* ignore */ }
        }, 600);
      };

      handlePointerUp = () => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      };

      handlePointerMove = (e: PointerEvent) => {
        const dx = e.clientX - longPressX;
        const dy = e.clientY - longPressY;
        if (Math.sqrt(dx * dx + dy * dy) > 8) {
          longPressMoved = true;
          if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        }
      };

      el.addEventListener('pointerdown',   handlePointerDown);
      el.addEventListener('pointerup',     handlePointerUp);
      el.addEventListener('pointermove',   handlePointerMove);
      el.addEventListener('pointercancel', handlePointerUp);

      setReady(true);
    }).catch(e => setError(e.message));

    return () => {
      destroyed = true;
      if (searchAreaTimer) clearTimeout(searchAreaTimer);
      if (el) {
        if (handlePointerDown)  el.removeEventListener('pointerdown',   handlePointerDown);
        if (handlePointerUp)    el.removeEventListener('pointerup',     handlePointerUp);
        if (handlePointerMove)  el.removeEventListener('pointermove',   handlePointerMove);
        if (handlePointerUp)    el.removeEventListener('pointercancel', handlePointerUp);
      }
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
    const groups = new Map<string, IEventSearchShortItem[]>();
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
      const color = markerColors(first);
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
      const clusterEvents: IEventSearchShortItem[] = [];
      placemarks.forEach((pm: any) => {
        (pm._elistGroup ?? []).forEach((ev: IEventSearchShortItem) => clusterEvents.push(ev));
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

      {/* Контекстное меню «Искать поблизости» */}
      {ctxMenu && (
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: Math.min(ctxMenu.x + 4, (containerRef.current?.offsetWidth ?? 300) - 190),
            top:  Math.min(ctxMenu.y + 4, (containerRef.current?.offsetHeight ?? 400) - 200),
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 4px 24px rgba(0,0,0,0.28)',
            zIndex: 50,
            minWidth: 180,
            overflow: 'hidden',
          }}
        >
          {/* Заголовок */}
          <div style={{
            padding: '8px 14px 6px',
            fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: 'var(--text-secondary)',
            borderBottom: '1px solid var(--border)',
          }}>
            Искать поблизости
          </div>

          {/* Варианты радиуса */}
          {[
            { label: '300 м',  radius: 300   },
            { label: '500 м',  radius: 500   },
            { label: '1 км',   radius: 1000  },
            { label: '3 км',   radius: 3000  },
            { label: '5 км',   radius: 5000  },
          ].map(({ label, radius }) => (
            <button key={radius}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '9px 14px', background: 'none', border: 'none',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', textAlign: 'left',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              onClick={() => handleSearchHere(ctxMenu.lat, ctxMenu.lng, radius)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="3" fill="var(--accent)" stroke="none"/>
              </svg>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Список мероприятий на одной точке */}
      {groupState && (
        <PointGroupModal
          events={groupState.events}
          anchorX={groupState.x}
          anchorY={groupState.y}
          onSelect={id => { setGroupState(null); onMarkerClick(id); }}
          onClose={() => setGroupState(null)}
        />
      )}
    </div>
  );
}

// ---- Модальный список мероприятий в одной точке ----

function PointGroupModal({ events, anchorX, anchorY, onSelect, onClose }: {
  events: IEventSearchShortItem[];
  anchorX: number;
  anchorY: number;
  onSelect: (id: string) => void;
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
            const colors = markerColors(ev);
            const color = colors[0];
            return (
              <button key={ev.id} className={styles.groupItem} onClick={() => onSelect(ev.id)}>
                <div className={styles.groupDot} style={{ background: color }} />
                <div className={styles.groupItemInfo}>
                  <span className={styles.groupItemName}>{ev.name}</span>
                  <span className={styles.groupItemMeta}>
                    <span>Подробнее</span>
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
