// pages/home/HomePage.tsx
// Главная страница: карта + список + фильтры

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { IEvent, EventViewMode, IEventsSearchParams } from '@/entities/event';
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

export default function HomePage() {
  const [viewMode, setViewMode] = useState<EventViewMode>('map');
  const [selectedEvent, setSelectedEvent] = useState<IEvent | null>(null);
  const [searchName, setSearchName] = useState('');

  const navigate = useNavigate();
  const { filters, setFilter } = useFiltersStore();
  const { toggle: toggleFav, isFavorite } = useFavoritesStore();
  const {
    coords: userCoords,
    showCityConfirm,
    detectedCity,
    confirmCity,
    keepOldCity,
  } = useUserLocation();

  // Запоминаем начальный центр при монтировании — не меняем его при навигации
  const initialCenter = useRef<[number, number]>([
    filters.latitude ?? userCoords.lat,
    filters.longitude ?? userCoords.lng,
  ]);

  const debouncedName = useDebounce(searchName, 300);

  const params: IEventsSearchParams = {
    ...filters,
    name: debouncedName || undefined,
  };

  const { events, isLoading, isLoadingMore, hasMore, loadMore } = useEvents(params);
  const sentinelRef = useInfiniteScroll(loadMore);

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
              center={initialCenter.current}
            />
          </div>
        ) : (
          /* LIST VIEW */
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
                <p style={{ fontSize: 12 }}>Попробуйте другой город, изменить радиус или убрать некоторые фильтры</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {events.map((event, idx) => (
                  <>
                    <EventCard.Preset
                      key={event.id}
                      event={event}
                      onClick={e => navigate(`/event/${e.id}`)}
                      isFavorite={isFavorite(event.id)}
                      onFavorite={toggleFav}
                    />
                    {/* Реклама каждые AD_EVERY карточек */}
                    {(idx + 1) % AD_EVERY === 0 && (
                      <AdSlot key={`ad-${idx}`} blockId={AD_BLOCK_ID} />
                    )}
                  </>
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
