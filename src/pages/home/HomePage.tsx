// pages/home/HomePage.tsx
// Главная страница: карта + список + фильтры

import { useState, useCallback, useEffect, useRef, useMemo, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import type { IEvent, IEventsSearchParams } from '@/entities/event';
import { EventCard } from '@/entities/event';
import { useEvents } from '@/features/event-list/useEvents';
import { useFiltersStore, useFavoritesStore } from '@/app/store';
import { useInfiniteScroll, useDebounce } from '@/shared/hooks';
import { EventModal } from './EventModal';
import { FilterBar } from '@/features/event-filters/FilterBar';
import { EventMap } from '@/features/event-map/EventMap';
import { useUserLocation } from '@/features/auth/useUserLocation';
import { CityConfirmDialog } from '@/shared/ui/CityConfirmDialog/CityConfirmDialog';
import { AdSlot } from '@/shared/ui/AdSlot/AdSlot';
import styles from './HomePage.module.css';

// ID рекламного блока из кабинета РСЯ (partner.yandex.ru)
// Формат: R-A-XXXXXXX-X
const AD_BLOCK_ID = import.meta.env.VITE_YANDEX_AD_BLOCK_ID ?? '';
const AD_EVERY    = 12; // реклама каждые N карточек

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

  const navigate = useNavigate();
  const listElRef = useRef<HTMLDivElement>(null);
  const scrollSaveTimerRef = useRef<number | null>(null);
  const prevParamsKeyRef = useRef<string | null>(null);
  const { filters, setFilter, viewMode, setViewMode, mapCenter, setMapCenter, mapZoom, setMapZoom } = useFiltersStore();
  const { toggle: toggleFav, isFavorite } = useFavoritesStore();
  const {
    coords: userCoords,
    showCityConfirm,
    detectedCity,
    confirmCity,
    keepOldCity,
    triggerCityCheck,
  } = useUserLocation();

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

  const { events, isLoading, isLoadingMore, hasMore, loadMore } = useEvents(params);
  const sentinelRef = useInfiniteScroll(loadMore);

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

  const handleEventClick = useCallback((event: IEvent) => {
    setSelectedEvent(event);
  }, []);

  // Ручной триггер поиска (по кнопке «Искать» в фильтрах)
  // useEvents уже реагирует на изменение params автоматически,
  // поэтому onSearch нужен только для закрытия фильтров и сброса пагинации
  const handleSearch = useCallback(() => {
    // params уже обновлены через store — useEvents перезагрузит автоматически
  }, []);

  return (
    <div className={styles.page}>
      {/* ---- Filter bar ---- */}
      <FilterBar
        searchName={searchName}
        onSearchChange={setSearchName}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={handleSearch}
      />

      {/* ---- Content area ---- */}
      <div className={styles.content}>
        {viewMode === 'map' ? (
          /* MAP VIEW */
          <div className={styles.mapPlaceholder}>
            <EventMap
              events={events}
              onMarkerClick={handleEventClick}
              center={computedCenter}
              zoom={mapZoom}
              onCenterChange={setMapCenter}
              onZoomChange={setMapZoom}
            />
          </div>
        ) : (
          /* LIST VIEW */
          <div className={styles.list} ref={listElRef}>
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
                <p style={{ fontSize: 12 }}>Попробуйте другой город, изменить радиус или убрать некоторые фильтры</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {events.map((event, idx) => (
                  <Fragment key={event.id}>
                    <EventCard.Preset
                      event={event}
                      onClick={e => navigate(`/event/${e.id}`)}
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

            {/* Infinite scroll sentinel */}
            {hasMore && (
              <div ref={sentinelRef} className={styles.sentinel}>
                {isLoadingMore && <span className={styles.loadingMore}>Загрузка...</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- Event popup modal ---- */}
      {selectedEvent && (
        <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
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

/* ---- Skeleton ---- */

function SkeletonCard() {
  return <div className={styles.skeleton} aria-hidden />;
}
