// pages/home/HomePage.tsx
// Главная страница: карта + список + фильтры

import { useState, useCallback, useEffect } from 'react';
import type { IEvent, EventViewMode, IEventsSearchParams } from '@/entities/event';
import { EventCard } from '@/entities/event';
import { useEvents } from '@/features/event-list/useEvents';
import { useFiltersStore, useFavoritesStore } from '@/app/store';
import { useInfiniteScroll, useDebounce } from '@/shared/hooks';
import { EventModal } from './EventModal';
import { FilterBar } from './FilterBar';
import { EventMap } from '@/features/event-map/EventMap';
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
          /* MAP VIEW — реальная Leaflet карта */
          <div className={styles.mapPlaceholder}>
            <EventMap
              events={events}
              onMarkerClick={handleEventClick}
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

/* ---- Skeleton ---- */

function SkeletonCard() {
  return <div className={styles.skeleton} aria-hidden />;
}
