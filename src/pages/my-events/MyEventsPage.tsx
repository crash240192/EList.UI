// pages/my-events/MyEventsPage.tsx

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { EventCard } from '@/entities/event';
import { useMyEvents, type OwnerFilter } from '@/features/event-list/useMyEvents';
import { FilterBar } from '@/features/event-filters/FilterBar';
import { useMyEventsFiltersStore, useFavoritesStore } from '@/app/store';
import { useAccountId } from '@/features/auth/useAccountId';
import { useInfiniteScroll, useDebounce } from '@/shared/hooks';
import type { IEventsSearchParams, EventViewMode } from '@/entities/event';
import styles from './MyEventsPage.module.css';

type Tab = 'active' | 'archive';

const OWNER_TABS = [
  { key: 'all',    label: 'Все мои' },
  { key: 'mine',   label: 'Организую' },
  { key: 'others', label: 'Участвую' },
];

export default function MyEventsPage() {
  const navigate = useNavigate();
  const { toggle: toggleFav, isFavorite } = useFavoritesStore();
  const { accountId, loading: accountLoading } = useAccountId();
  const { filters, setFilter, resetFilters } = useMyEventsFiltersStore();

  const [tab,         setTab]         = useState<Tab>('active');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');
  const [searchName,  setSearchName]  = useState('');
  const [viewMode,    setViewMode]    = useState<EventViewMode>('list');
  const [searchVersion, setSearchVersion] = useState(0);

  const handleSearch = () => setSearchVersion(v => v + 1);

  const debouncedName      = useDebounce(searchName, 300);
  const selectedCategories = filters.categories ?? [];
  const selectedTypes      = filters.types      ?? [];

  const extraParams = useMemo<Partial<IEventsSearchParams>>(() => ({
    name:       debouncedName    || undefined,
    categories: selectedCategories.length ? selectedCategories : undefined,
    types:      selectedTypes.length      ? selectedTypes      : undefined,
    startTime:  filters.startTime,
    endTime:    filters.endTime,
    price:      filters.price,
  // @ts-ignore
    _v:         searchVersion,
  }), [debouncedName, selectedCategories, selectedTypes,
       filters.startTime, filters.endTime, filters.price, searchVersion]);

  const { events, isLoading, isLoadingMore, hasMore, loadMore } = useMyEvents({
    accountId,
    ownerFilter,
    extraParams,
    tab,
  });

  const sentinelRef = useInfiniteScroll(loadMore);
  const isReady = !accountLoading && !!accountId;

  return (
    <div className={styles.page}>

      {/* ---- FilterBar с вкладками организатор/участник ---- */}
      <FilterBar
        searchName={searchName}
        onSearchChange={setSearchName}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={handleSearch}
        useStore={useMyEventsFiltersStore}
        hideCity
        hideViewToggle
        tabs={OWNER_TABS}
        activeTab={ownerFilter}
        onTabChange={key => setOwnerFilter(key as OwnerFilter)}
      />

      {/* ── Кнопка создать + переключатель активные/прошедшие ── */}
      <div className={styles.subHeader}>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'active'  ? styles.tabActive : ''}`}
            onClick={() => setTab('active')}>Активные</button>
          <button className={`${styles.tab} ${tab === 'archive' ? styles.tabActive : ''}`}
            onClick={() => setTab('archive')}>Прошедшие</button>
        </div>
        <button className={styles.createBtn} onClick={() => navigate('/create-event')}>
          + Создать
        </button>
      </div>

      {/* ---- Content ---- */}
      <div className={styles.list}>
        {!isReady || isLoading ? (
          <div className={styles.grid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.skeleton} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className={styles.empty}>
            <span>{tab === 'active' ? '📅' : '📦'}</span>
            <p>{tab === 'active' ? 'Нет активных событий' : 'Прошедшие пусты'}</p>
            {tab === 'active' && (
              <button className={styles.emptyBtn} onClick={() => navigate('/')}>
                Найти события
              </button>
            )}
          </div>
        ) : (
          <div className={styles.grid}>
            {events.map(event => (
              <div key={event.id} className={styles.cardWrap}>
                {event.isOrganizer && (
                  <span className={styles.organizerTag}>Организатор</span>
                )}
                <EventCard.Preset
                  event={event}
                  onClick={() => navigate(`/event/${event.id}`)}
                  isFavorite={isFavorite(event.id)}
                  onFavorite={toggleFav}
                  className={event.isOrganizer ? styles.cardOrganizer : undefined}
                />
              </div>
            ))}
          </div>
        )}

        {hasMore && (
          <div ref={sentinelRef} className={styles.sentinel}>
            {isLoadingMore && <span className={styles.loadingMore}>Загрузка...</span>}
          </div>
        )}
      </div>
    </div>
  );
}
