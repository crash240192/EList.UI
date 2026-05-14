// pages/my-events/MyEventsPage.tsx

import { useState, useMemo, useEffect, useRef } from 'react';
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

const SS_TAB = 'elist_my_events_tab_v1';
const SS_OWNER = 'elist_my_events_owner_v1';
const SS_CANCELLED = 'elist_my_events_show_cancelled_v1';
const SS_LIST_UI = 'elist_my_events_list_ui_v1';

function readTab(): Tab {
  try {
    const v = sessionStorage.getItem(SS_TAB);
    return v === 'archive' ? 'archive' : 'active';
  } catch {
    return 'active';
  }
}

function readOwner(): OwnerFilter {
  try {
    const v = sessionStorage.getItem(SS_OWNER);
    if (v === 'mine' || v === 'others' || v === 'all') return v;
  } catch { /* ignore */ }
  return 'all';
}

function readShowCancelled(): boolean {
  try {
    return sessionStorage.getItem(SS_CANCELLED) === '1';
  } catch {
    return false;
  }
}

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

  const [tab,           setTab]           = useState<Tab>(readTab);
  const [ownerFilter,   setOwnerFilter]   = useState<OwnerFilter>(readOwner);
  const [searchName,    setSearchName]    = useState('');
  const [viewMode,      setViewMode]      = useState<EventViewMode>('list');
  const [searchVersion, setSearchVersion] = useState(0);
  const [showCancelled, setShowCancelled] = useState(readShowCancelled);

  const listElRef = useRef<HTMLDivElement>(null);
  const scrollSaveTimerRef = useRef<number | null>(null);
  const prevListKeyRef = useRef<string | null>(null);

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
    // Для вкладки «Организую» с чекбоксом: если показываем отменённые — active: false
    ...(ownerFilter === 'mine' && showCancelled ? { active: false } : {}),
  // @ts-ignore
    _v:         searchVersion,
  }), [debouncedName, selectedCategories, selectedTypes,
       filters.startTime, filters.endTime, filters.price,
       ownerFilter, showCancelled, searchVersion]);

  const { events, isLoading, isLoadingMore, hasMore, loadMore } = useMyEvents({
    accountId,
    ownerFilter,
    extraParams,
    tab,
  });

  const isReady = !accountLoading && !!accountId;

  const listUiKey = useMemo(
    () => JSON.stringify({ tab, ownerFilter, extraParams }),
    [tab, ownerFilter, extraParams],
  );

  useEffect(() => {
    try {
      sessionStorage.setItem(SS_TAB, tab);
    } catch { /* ignore */ }
  }, [tab]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SS_OWNER, ownerFilter);
    } catch { /* ignore */ }
  }, [ownerFilter]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SS_CANCELLED, showCancelled ? '1' : '0');
    } catch { /* ignore */ }
  }, [showCancelled]);

  useEffect(() => {
    if (prevListKeyRef.current !== null && prevListKeyRef.current !== listUiKey) {
      try {
        sessionStorage.removeItem(SS_LIST_UI);
      } catch { /* ignore */ }
    }
    prevListKeyRef.current = listUiKey;
  }, [listUiKey]);

  useEffect(() => {
    if (!isReady || isLoading) return;
    const el = listElRef.current;
    if (!el) return;
    try {
      const raw = sessionStorage.getItem(SS_LIST_UI);
      if (!raw) return;
      const o = JSON.parse(raw) as { scrollTop?: number; listUiKey?: string };
      if (o.listUiKey !== listUiKey) return;
      const top = o.scrollTop;
      if (typeof top !== 'number') return;
      requestAnimationFrame(() => {
        el.scrollTop = top;
      });
    } catch { /* ignore */ }
  }, [isReady, isLoading, listUiKey, events.length]);

  useEffect(() => {
    const el = listElRef.current;
    if (!el || !isReady) return;
    const onScroll = () => {
      if (scrollSaveTimerRef.current) window.clearTimeout(scrollSaveTimerRef.current);
      scrollSaveTimerRef.current = window.setTimeout(() => {
        scrollSaveTimerRef.current = null;
        try {
          sessionStorage.setItem(
            SS_LIST_UI,
            JSON.stringify({ scrollTop: el.scrollTop, listUiKey }),
          );
        } catch { /* ignore */ }
      }, 150);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (scrollSaveTimerRef.current) window.clearTimeout(scrollSaveTimerRef.current);
    };
  }, [isReady, listUiKey]);

  const sentinelRef = useInfiniteScroll(loadMore);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {ownerFilter === 'mine' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={showCancelled}
                onChange={e => setShowCancelled(e.target.checked)} />
              Показывать отменённые
            </label>
          )}
          <button className={styles.createBtn} onClick={() => navigate('/create-event')}>
            + Создать
          </button>
        </div>
      </div>

      {/* ---- Content ---- */}
      <div className={styles.list} ref={listElRef}>
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
