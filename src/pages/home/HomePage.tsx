// pages/home/HomePage.tsx
// Главная страница: карта + список + фильтры

import { useState, useCallback, useEffect, useRef, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import type { IEvent, IEventsSearchParams } from '@/entities/event';
import { EventCard, fetchEventById, EVENTS_MAP_SHORT_PAGE_SIZE } from '@/entities/event';
import { useEvents } from '@/features/event-list/useEvents';
import { useEventsMapShort } from '@/features/event-list/useEventsMapShort';
import { useFiltersStore, useFavoritesStore } from '@/app/store';
import { useInfiniteScroll, useDebounce } from '@/shared/hooks';
import { EventModal } from './EventModal';
import { FilterBar } from '@/features/event-filters/FilterBar';
import { EventMap } from '@/features/event-map/EventMap';
import { useUserLocation } from '@/features/auth/useUserLocation';
import { CityConfirmDialog } from '@/shared/ui/CityConfirmDialog/CityConfirmDialog';
import { AdSlot } from '@/shared/ui/AdSlot/AdSlot';
import { reverseGeocodeLocalityLabel } from '@/shared/lib/yandexMaps';
import styles from './HomePage.module.css';

// ID рекламного блока из кабинета РСЯ (partner.yandex.ru)
// Формат: R-A-XXXXXXX-X
const AD_BLOCK_ID = import.meta.env.VITE_YANDEX_AD_BLOCK_ID ?? '';
const AD_EVERY    = 12; // реклама каждые N карточек

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, x)));
}

export default function HomePage() {
  const [selectedEvent, setSelectedEvent] = useState<IEvent | null>(null);
  const [searchName, setSearchName] = useState('');
  const [mapTruncationOpen, setMapTruncationOpen] = useState(false);

  const navigate = useNavigate();
  const { filters, setFilter, viewMode, setViewMode, mapCenter, setMapCenter, mapZoom, setMapZoom } =
    useFiltersStore();
  const { toggle: toggleFav, isFavorite } = useFavoritesStore();
  const {
    coords: userCoords,
    showCityConfirm,
    detectedCity,
    confirmCity,
    keepOldCity,
    triggerCityCheck,
  } = useUserLocation();

  const lastViewportRef   = useRef<{ lat: number; lng: number; zoom: number } | null>(null);
  const geocodeTimerRef   = useRef<number | null>(null);
  const prevMapLoadingRef = useRef(false);

  useEffect(() => () => {
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
  }, []);

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

  const { events, isLoading, isLoadingMore, hasMore, loadMore } = useEvents(params, viewMode === 'list');
  const { items: mapShortItems, isLoading: mapShortLoading, error: mapShortError, total: mapShortTotal } =
    useEventsMapShort(params, viewMode === 'map');
  const sentinelRef = useInfiniteScroll(loadMore);

  useEffect(() => {
    if (viewMode !== 'map') {
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

  /** Видимая область карты → фильтры lat/lng/radius; подпись города — отдельно (геокодер, без лишних вызовов при одном зуме). */
  const handleMapSearchArea = useCallback(
    (area: { lat: number; lng: number; radiusM: number; zoom: number }) => {
      setFilter('latitude', area.lat);
      setFilter('longitude', area.lng);
      setFilter('locationRange', area.radiusM);
      setMapCenter([area.lat, area.lng]);

      const prev = lastViewportRef.current;
      lastViewportRef.current = { lat: area.lat, lng: area.lng, zoom: area.zoom };

      if (prev) {
        const movedM = haversineMeters(prev, area);
        const zoomChanged = Math.round(prev.zoom) !== Math.round(area.zoom);
        if (zoomChanged && movedM < 700) return;
      }

      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
      geocodeTimerRef.current = window.setTimeout(() => {
        geocodeTimerRef.current = null;
        const c = lastViewportRef.current;
        if (!c) return;
        void reverseGeocodeLocalityLabel(c.lat, c.lng).then((name) => {
          window.dispatchEvent(new CustomEvent('elist:mapViewportLocality', { detail: { name } }));
        });
      }, 480);
    },
    [setFilter, setMapCenter],
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
          <div className={styles.list}>
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
                      isFavorite={isFavorite(event.id)}
                      onFavorite={toggleFav}
                    />
                    {(idx + 1) % AD_EVERY === 0 && (
                      <AdSlot key={`ad-${event.id}`} blockId={AD_BLOCK_ID} />
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
