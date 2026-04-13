// pages/my-events/MyEventsPage.tsx

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { EventCard } from '@/entities/event';
import { useMyEvents, type OwnerFilter } from '@/features/event-list/useMyEvents';
import { useFiltersStore, useFavoritesStore } from '@/app/store';
import { useAccountId } from '@/features/auth/useAccountId';
import { useInfiniteScroll, useDebounce } from '@/shared/hooks';
import { CategoryTypePicker } from '@/features/event-filters/CategoryTypePicker';
import type { IEventsSearchParams } from '@/entities/event';
import styles from './MyEventsPage.module.css';

type Tab = 'active' | 'archive';

export default function MyEventsPage() {
  const navigate = useNavigate();
  const { toggle: toggleFav, isFavorite } = useFavoritesStore();
  const { accountId, loading: accountLoading } = useAccountId();
  const { filters, setFilter, resetFilters } = useFiltersStore();

  const [tab, setTab]               = useState<Tab>('active');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');
  const [searchName, setSearchName] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pickerOpen, setPickerOpen]   = useState(false);

  const debouncedName      = useDebounce(searchName, 300);
  const selectedCategories = filters.categories ?? [];
  const selectedTypes      = filters.types      ?? [];
  const typeFilterCount    = selectedCategories.length + selectedTypes.length;
  const hasActiveFilters   = !!(filters.startTime || filters.endTime ||
                               typeFilterCount > 0 || filters.price);

  const extraParams = useMemo<Partial<IEventsSearchParams>>(() => ({
    name:       debouncedName    || undefined,
    categories: selectedCategories.length ? selectedCategories : undefined,
    types:      selectedTypes.length      ? selectedTypes      : undefined,
    startTime:  filters.startTime,
    endTime:    filters.endTime,
    price:      filters.price,
  }), [debouncedName, selectedCategories, selectedTypes,
       filters.startTime, filters.endTime, filters.price]);

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

      {/* ---- Header ---- */}
      <div className={styles.header}>
        <h2 className={styles.title}>Мои события</h2>
        <button className={styles.createBtn} onClick={() => navigate('/create-event')}>
          + Создать
        </button>
      </div>

      {/* ---- Owner filter chips ---- */}
      <div className={styles.ownerFilter}>
        {(['all', 'mine', 'others'] as OwnerFilter[]).map(f => (
          <button key={f}
            className={`${styles.filterChip} ${ownerFilter === f ? styles.filterChipActive : ''}`}
            onClick={() => setOwnerFilter(f)}>
            {{ all: 'Все', mine: 'Мои', others: 'Подписки' }[f]}
          </button>
        ))}
      </div>

      {/* ---- Search + filter toggle ---- */}
      <div className={styles.searchBar}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input className={styles.searchInput} placeholder="Поиск по названию..."
            value={searchName} onChange={e => setSearchName(e.target.value)} />
          {searchName && (
            <button className={styles.clearBtn} onClick={() => setSearchName('')}>✕</button>
          )}
        </div>
        <button
          className={`${styles.filterToggle} ${hasActiveFilters ? styles.filterActive : ''}`}
          onClick={() => setFiltersOpen(v => !v)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          {hasActiveFilters && <span className={styles.filterDot}/>}
        </button>
      </div>

      {/* ---- Expanded filters ---- */}
      {filtersOpen && (
        <div className={styles.expandedFilters}>
          <div className={styles.filterGroupFull}>
            <label className={styles.filterLabel}>Тип мероприятия</label>
            <button
              className={`${styles.pickerBtn} ${typeFilterCount > 0 ? styles.pickerBtnActive : ''}`}
              onClick={() => setPickerOpen(true)}>
              {typeFilterCount > 0 ? `Выбрано: ${typeFilterCount}` : 'Все категории и типы'}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" style={{ marginLeft: 'auto' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Дата от</label>
              <input type="datetime-local" className={styles.filterInput}
                value={filters.startTime ? toLocalInput(filters.startTime) : ''}
                onChange={e => setFilter('startTime', e.target.value
                  ? new Date(e.target.value).toISOString() : undefined)} />
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Дата до</label>
              <input type="datetime-local" className={styles.filterInput}
                value={filters.endTime ? toLocalInput(filters.endTime) : ''}
                onChange={e => setFilter('endTime', e.target.value
                  ? new Date(e.target.value).toISOString() : undefined)} />
            </div>
          </div>
          <div className={styles.filterGroup} style={{ width: '50%' }}>
            <label className={styles.filterLabel}>Макс. цена</label>
            <input type="number" min={0} step={100} className={styles.filterInput}
              placeholder="Любая" value={filters.price ?? ''}
              onChange={e => setFilter('price', e.target.value
                ? Number(e.target.value) : undefined)} />
          </div>
          {hasActiveFilters && (
            <button className={styles.resetBtn}
              onClick={() => { resetFilters(); setSearchName(''); }}>
              Сбросить всё
            </button>
          )}
        </div>
      )}

      {/* ---- Tabs ---- */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'active'  ? styles.tabActive : ''}`}
          onClick={() => setTab('active')}>Активные</button>
        <button className={`${styles.tab} ${tab === 'archive' ? styles.tabActive : ''}`}
          onClick={() => setTab('archive')}>Архив</button>
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
            <p>{tab === 'active' ? 'Нет активных событий' : 'Архив пуст'}</p>
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

      {pickerOpen && (
        <CategoryTypePicker
          selectedCategories={selectedCategories}
          selectedTypes={selectedTypes}
          onChange={(cats, types) => {
            setFilter('categories', cats.length ? cats : undefined);
            setFilter('types',      types.length ? types : undefined);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
