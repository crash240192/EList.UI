// pages/home/HomePage.tsx
// Главная страница: карта + список + фильтры

import { useState, useCallback, useEffect, useRef, useMemo, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import type { IEvent, IEventsSearchParams } from '@/entities/event';
import { EventCard, fetchEventById, EVENTS_MAP_SHORT_PAGE_SIZE } from '@/entities/event';
import { useEvents } from '@/features/event-list/useEvents';
import { useEventsMapShort } from '@/features/event-list/useEventsMapShort';
import { useFiltersStore } from '@/app/store';
import { useInfiniteScroll, useDebounce } from '@/shared/hooks';
import { EventModal } from './EventModal';
import { FilterBar } from '@/features/event-filters/FilterBar';
import { EventMap } from '@/features/event-map/EventMap';
import { useUserLocation } from '@/features/auth/useUserLocation';
import { CityConfirmDialog } from '@/shared/ui/CityConfirmDialog/CityConfirmDialog';
import { AdSlot } from '@/shared/ui/AdSlot/AdSlot';
import { shouldInsertAdAfterIndex } from '@/shared/lib/adConfig';
import styles from './HomePage.module.css';

const HOME_LIST_UI_KEY = 'elist_home_list_ui_v1';
const HOME_SEARCH_KEY  = 'elist_home_list_search_v1';

interface StoredListUi { scrollTop: number; paramsKey: string }

function readStoredListUi(): StoredListUi | null {
  try {
    const raw = sessionStorage.getItem(HOME_LIST_UI_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as StoredListUi;
    if (typeof o.scrollTop !== 'number' || typeof o.paramsKey !== 'string') return null;
    return o;
  } catch {
    return null;
  }
}

export default function HomePage() {
  const [selectedEvent, setSelectedEvent] = useState<IEvent | null>(null);
  const [searchName, setSearchName] = useState(() => {
    try {
      return sessionStorage.getItem(HOME_SEARCH_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [mapTruncationOpen, setMapTruncationOpen] = useState(false);

  const navigate = useNavigate();
  const listElRef = useRef<HTMLDivElement>(null);
  const scrollSaveTimerRef = useRef<number | null>(null);
  const prevParamsKeyRef = useRef<string | null>(null);
  const { filters, setFilter, viewMode, setViewMode, mapCenter, setMapCenter, mapZoom, setMapZoom } =
    useFiltersStore();
  const {
    coords: userCoords,
    showCityConfirm,
    detectedCity,
    confirmCity,
    keepOldCity,
    triggerCityCheck,
  } = useUserLocation();

  const prevMapLoadingRef = useRef(false);

  // Слушаем событие сброса города из FilterBar
  useEffect(() => {
    const handler = () => triggerCityCheck();
    window.addEventListener('elist:resetCityDecision', handler);
    return () => window.removeEventListener('elist:resetCityDecision', handler);
  }, [triggerCityCheck]);

  // Центр карты: всегда из стора (живёт между навигациями)
  const computedCenter: [number, number] = mapCenter
    ?? [filters.latitude ?? userCoords.lat, filters.longitude ?? userCoords.lng];

  const debouncedName = useDebounce(searchName, 300);

  const params: IEventsSearchParams = {
    ...filters,
    name: debouncedName || undefined,
  };

  const paramsKey = useMemo(() => JSON.stringify(params), [filters, debouncedName]);

  const { events, isLoading, isLoadingMore, hasMore, loadMore } = useEvents(params, viewMode === 'list');
  const { items: mapShortItems, isLoading: mapShortLoading, error: mapShortError, total: mapShortTotal } =
    useEventsMapShort(params, viewMode === 'map');
  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: viewMode === 'list' && !isLoading && !isLoadingMore && hasMore,
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(HOME_SEARCH_KEY, searchName);
    } catch { /* ignore */ }
  }, [searchName]);

  useEffect(() => {
    if (prevParamsKeyRef.current !== null && prevParamsKeyRef.current !== paramsKey) {
      try {
        sessionStorage.removeItem(HOME_LIST_UI_KEY);
      } catch { /* ignore */ }
    }
    prevParamsKeyRef.current = paramsKey;
  }, [paramsKey]);

  useEffect(() => {
    if (viewMode !== 'list' || isLoading) return;
    const el = listElRef.current;
    if (!el) return;
    const stored = readStoredListUi();
    if (!stored || stored.paramsKey !== paramsKey) return;
    const top = stored.scrollTop;
    requestAnimationFrame(() => {
      el.scrollTop = top;
    });
  }, [viewMode, isLoading, paramsKey, events.length]);

  useEffect(() => {
    const el = listElRef.current;
    if (!el || viewMode !== 'list') return;
    const onScroll = () => {
      if (scrollSaveTimerRef.current) window.clearTimeout(scrollSaveTimerRef.current);
      scrollSaveTimerRef.current = window.setTimeout(() => {
        scrollSaveTimerRef.current = null;
        try {
          const payload: StoredListUi = { scrollTop: el.scrollTop, paramsKey };
          sessionStorage.setItem(HOME_LIST_UI_KEY, JSON.stringify(payload));
        } catch { /* ignore */ }
      }, 150);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (scrollSaveTimerRef.current) window.clearTimeout(scrollSaveTimerRef.current);
    };
  }, [viewMode, paramsKey]);

  useEffect(() => {
    if (viewMode !== 'map') {
      setMapTruncationOpen(false);
      prevMapLoadingRef.current = mapShortLoading;
      return;
    }
    const finished = prevMapLoadingRef.current && !mapShortLoading;
    prevMapLoadingRef.current = mapShortLoading;
    if (finished && mapShortTotal > EVENTS_MAP_SHORT_PAGE_SIZE) setMapTruncationOpen(true);
  }, [viewMode, mapShortLoading, mapShortTotal]);

  const handleListEventClick = useCallback((event: IEvent) => {
    navigate(`/event/${event.id}`);
  }, [navigate]);

  const handleMapMarkerClick = useCallback(async (eventId: string) => {
    try {
      const ev = await fetchEventById(eventId);
      setSelectedEvent(ev);
    } catch {
      /* превью не загрузилось — модалку не открываем */
    }
  }, []);

  /** Видимая область карты → lat/lng/radius в стор для search/short; подпись города в фильтре не меняем. */
  const handleMapSearchArea = useCallback(
    (area: { lat: number; lng: number; radiusM: number }) => {
      useFiltersStore.setState((s) => ({
        filters: {
          ...s.filters,
          latitude: area.lat,
          longitude: area.lng,
          locationRange: area.radiusM,
        },
      }));
      setMapCenter([area.lat, area.lng]);
    },
    [setMapCenter],
  );

  const handleSearch = useCallback(() => {
    // params уже обновлены через store — useEvents перезагрузит автоматически
  }, []);

  return (
    <div className={styles.page}>
      <FilterBar
        searchName={searchName}
        onSearchChange={setSearchName}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={handleSearch}
      />

      <div className={styles.content}>
        {viewMode === 'map' ? (
          <div className={styles.mapPlaceholder}>
            <div className={styles.mapWrap}>
              {mapShortLoading && (
                <div className={styles.mapCornerSpinner} aria-busy aria-label="Загрузка точек на карте">
                  <span className={styles.mapCornerSpinnerRing} />
                </div>
              )}
              {mapShortError && (
                <div className={styles.mapErrorBanner}>{mapShortError}</div>
              )}
              <EventMap
                events={mapShortItems}
                onMarkerClick={handleMapMarkerClick}
                center={computedCenter}
                zoom={mapZoom}
                onCenterChange={setMapCenter}
                onZoomChange={setMapZoom}
                onSearchAreaChange={handleMapSearchArea}
              />
            </div>
          </div>
        ) : (
          <div key={`list-${paramsKey}`} className={styles.list} ref={listElRef}>
            {isLoading ? (
              <div className={styles.loading}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className={styles.empty}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4 }}>
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <p>Ничего не найдено</p>
                <p style={{ fontSize: 12 }}>Попробуйте сдвинуть карту, сменить масштаб, выбрать другой город или убрать часть фильтров</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {events.map((event, idx) => (
                  <Fragment key={event.id}>
                    <EventCard.Preset
                      event={event}
                      onClick={e => handleListEventClick(e)}
                    />
                    {shouldInsertAdAfterIndex(idx) && (
                      <AdSlot key={`ad-${event.id}`} />
                    )}
                  </Fragment>
                ))}
              </div>
            )}

            {hasMore && (
              <div ref={sentinelRef} className={styles.sentinel}>
                {isLoadingMore && <span className={styles.loadingMore}>Загрузка...</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedEvent && (
        <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}

      {mapTruncationOpen && (
        <>
          <button
            type="button"
            className={styles.mapTruncBackdrop}
            aria-label="Закрыть"
            onClick={() => setMapTruncationOpen(false)}
          />
          <div className={styles.mapTruncDialog} role="dialog" aria-modal>
            <p className={styles.mapTruncText}>
              По текущим условиям найдено событий: <strong>{mapShortTotal}</strong>.
              На карте отображаются не более {EVENTS_MAP_SHORT_PAGE_SIZE} — сузьте область карты или фильтры,
              чтобы увидеть все точки.
            </p>
            <button type="button" className={styles.mapTruncBtn} onClick={() => setMapTruncationOpen(false)}>
              Понятно
            </button>
          </div>
        </>
      )}

      {showCityConfirm && (
        <CityConfirmDialog
          cityName={detectedCity}
          onConfirm={confirmCity}
          onKeep={keepOldCity}
        />
      )}
    </div>
  );
}

function SkeletonCard() {
  return <div className={styles.skeleton} aria-hidden />;
}
