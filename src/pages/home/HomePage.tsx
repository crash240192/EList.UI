// pages/home/HomePage.tsx
// Главная страница: карта + список + фильтры

import { useState, useCallback } from 'react';
import type { IEvent, EventViewMode, IEventsSearchParams } from '@/entities/event';
import { EventCard } from '@/entities/event';
import { useEvents } from '@/features/event-list/useEvents';
import { useFiltersStore, useFavoritesStore } from '@/app/store';
import { useInfiniteScroll, useDebounce } from '@/shared/hooks';
import { EventModal } from './EventModal';
import { FilterBar } from './FilterBar';
import styles from './HomePage.module.css';

export default function HomePage() {
  const [viewMode, setViewMode] = useState<EventViewMode>('map');
  const [selectedEvent, setSelectedEvent] = useState<IEvent | null>(null);
  const [searchName, setSearchName] = useState('');

  const { filters, setFilter } = useFiltersStore();
  const { toggle: toggleFav, isFavorite } = useFavoritesStore();

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

  return (
    <div className={styles.page}>
      {/* ---- Filter bar ---- */}
      <FilterBar
        searchName={searchName}
        onSearchChange={setSearchName}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* ---- Content area ---- */}
      <div className={styles.content}>
        {viewMode === 'map' ? (
          /* MAP VIEW */
          <div className={styles.mapPlaceholder}>
            <MapPlaceholder events={events} onMarkerClick={handleEventClick} />
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
                <span>🔍</span>
                <p>Ничего не найдено. Попробуйте изменить фильтры.</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {events.map((event) => (
                  <EventCard.Preset
                    key={event.id}
                    event={event}
                    onClick={handleEventClick}
                    isFavorite={isFavorite(event.id)}
                    onFavorite={toggleFav}
                  />
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
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}

/* ---- Map placeholder (замените на реальную карту Leaflet/Яндекс) ---- */

function MapPlaceholder({
  events,
  onMarkerClick,
}: {
  events: IEvent[];
  onMarkerClick: (e: IEvent) => void;
}) {
  return (
    <div className={styles.mapMock}>
      <div className={styles.mapLabel}>
        🗺️ Здесь будет карта (Leaflet / Яндекс.Карты)
        <br />
        <small>Интегрируйте react-leaflet или ymaps3-react</small>
      </div>
      {/* Условные маркеры поверх плейсхолдера */}
      {events.map((event, i) => (
        <button
          key={event.id}
          className={styles.mockMarker}
          style={{
            left: `${15 + ((i * 17) % 70)}%`,
            top:  `${20 + ((i * 23) % 60)}%`,
          }}
          onClick={() => onMarkerClick(event)}
          title={event.name}
        >
          {event.eventType?.eventCategory?.namePath?.startsWith('music') ? '🎵' :
           event.eventType?.eventCategory?.namePath?.startsWith('sport') ? '⚽' : '📍'}
        </button>
      ))}
    </div>
  );
}

/* ---- Skeleton ---- */

function SkeletonCard() {
  return <div className={styles.skeleton} aria-hidden />;
}
