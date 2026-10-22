// pages/my-events/MyEventsPage.tsx

import { useState, useMemo, useEffect, useRef, Fragment, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { EventCard, type IEvent } from '@/entities/event';
import { EventList, EventListItem } from '@/entities/event/ui/EventListItem';
import { PinMenuGlyph } from '@/entities/event/ui/PinnedCoverBadge/PinnedCoverBadge';
import { useMyEvents, type OwnerFilter } from '@/features/event-list/useMyEvents';
import { useMyEventsPinsStore } from '@/features/event-list/myEventsPinsStore';
import {
  EMPTY_IDS,
  EMPTY_SNAPSHOTS,
  myEventsQueryIsNarrowed,
  orderPinnedMyEvents,
} from '@/features/event-list/orderPinnedMyEvents';
import { FilterBar } from '@/features/event-filters/FilterBar';
import { useMyEventsFiltersStore } from '@/app/store';
import { useAccountId } from '@/features/auth/useAccountId';
import { useInfiniteScroll, useDebounce, usePageTitle, useMediaQuery } from '@/shared/hooks';
import { media } from '@/shared/lib/breakpoints';
import type { IEventsSearchParams, EventViewMode } from '@/entities/event';
import { AdSlot } from '@/shared/ui/AdSlot/AdSlot';
import { shouldInsertAdAfterIndex } from '@/shared/lib/adConfig';
import { TabBar } from '@/shared/ui/TabBar';
import { PinHit } from './PinHit';
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

function cancelledLabel(event: { active?: boolean; cancelSource?: string | null }): string | null {
  if (event.active !== false) return null;
  return event.cancelSource === 'moderation' ? 'Отменено модерацией' : 'Отменено';
}

export default function MyEventsPage() {
  usePageTitle('Мои события');
  const isMobileList = useMediaQuery(media.mobile);
  const navigate = useNavigate();
  const { accountId, loading: accountLoading } = useAccountId();
  const { filters, setFilter, resetFilters } = useMyEventsFiltersStore();

  const [tab,           setTab]           = useState<Tab>(readTab);
  const [ownerFilter,   setOwnerFilter]   = useState<OwnerFilter>(readOwner);
  const [searchName,    setSearchName]    = useState('');
  const [viewMode,      setViewMode]      = useState<EventViewMode>('list');
  const [searchVersion, setSearchVersion] = useState(0);
  const [showCancelled, setShowCancelled] = useState(readShowCancelled);

  const listElRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const scrollSaveTimerRef = useRef<number | null>(null);
  const prevListKeyRef = useRef<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; eventId: string } | null>(null);

  const pinEntry = useMyEventsPinsStore((s) => (accountId ? s.byAccount[accountId] : undefined));
  const pinEvent = useMyEventsPinsStore((s) => s.pin);
  const unpinEvent = useMyEventsPinsStore((s) => s.unpin);
  const rememberPin = useMyEventsPinsStore((s) => s.remember);
  const pinnedIds = pinEntry?.ids ?? EMPTY_IDS;
  const pinSnapshots = pinEntry?.snapshots ?? EMPTY_SNAPSHOTS;
  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);

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
    ageLimit:   filters.ageLimit,
    adultOnly:  filters.adultOnly,
    // Галочка на всех вкладках: active: false включает отменённые в выдачу
    ...(showCancelled ? { active: false } : {}),
  // @ts-ignore
    _v:         searchVersion,
  }), [debouncedName, selectedCategories, selectedTypes,
       filters.startTime, filters.endTime, filters.price,
       filters.ageLimit, filters.adultOnly,
       showCancelled, searchVersion]);

  const { events, isLoading, isLoadingMore, hasMore, loadMore } = useMyEvents({
    accountId,
    ownerFilter,
    extraParams,
    tab,
  });

  const orderedEvents = useMemo(() => orderPinnedMyEvents({
    events,
    ids: pinnedIds,
    snapshots: pinSnapshots,
    allowSnapshots: !myEventsQueryIsNarrowed(extraParams),
    tab,
    owner: ownerFilter,
    showCancelled,
  }), [events, pinnedIds, pinSnapshots, extraParams, tab, ownerFilter, showCancelled]);

  useEffect(() => {
    if (!accountId) return;
    for (const event of events) {
      if (pinnedSet.has(event.id)) rememberPin(accountId, event);
    }
  }, [accountId, events, pinnedSet, rememberPin]);

  const openMenu = useCallback((event: IEvent, x: number, y: number) => {
    const width = 180;
    const height = 52;
    const margin = 8;
    setMenu({
      eventId: event.id,
      x: Math.max(margin, Math.min(x, window.innerWidth - width - margin)),
      y: Math.max(margin, Math.min(y, window.innerHeight - height - margin)),
    });
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    const onScroll = () => setMenu(null);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    const list = listElRef.current;
    list?.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      list?.removeEventListener('scroll', onScroll);
    };
  }, [menu]);

  const toggleMenuPin = () => {
    if (!menu || !accountId) return;
    const alreadyPinned = pinnedSet.has(menu.eventId);
    if (alreadyPinned) unpinEvent(accountId, menu.eventId);
    else {
      const event = orderedEvents.find((item) => item.id === menu.eventId);
      if (event) pinEvent(accountId, event);
    }
    setMenu(null);
    if (!alreadyPinned) {
      requestAnimationFrame(() => {
        listElRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  };

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

  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: !isLoading && !isLoadingMore && hasMore,
  });

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
      <div className={`${styles.subHeader} ${styles.subHeaderWithCancelled}`}>
        <TabBar
          className={styles.archiveTabs}
          tabs={[
            { id: 'active', label: 'Активные' },
            { id: 'archive', label: 'Прошедшие' },
          ]}
          activeId={tab}
          onChange={id => setTab(id as typeof tab)}
        />
        <div className={styles.subHeaderActions}>
          <label className={styles.showCancelled}>
            <input type="checkbox" checked={showCancelled}
              onChange={e => setShowCancelled(e.target.checked)} />
            <span>Показывать отменённые</span>
          </label>
          <button className={styles.createBtn} onClick={() => navigate('/create-event')}>
            + Создать
          </button>
        </div>
      </div>

      {/* ---- Content ---- */}
      <div className={styles.list} ref={listElRef}>
        {!isReady || isLoading ? (
          <div className={isMobileList ? styles.eventListSkeleton : styles.grid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.skeleton} />
            ))}
          </div>
        ) : orderedEvents.length === 0 ? (
          <div className={styles.empty}>
            <p>{tab === 'active' ? 'Нет активных событий' : 'Прошедшие пусты'}</p>
            {tab === 'active' && (
              <button className={styles.emptyBtn} onClick={() => navigate('/')}>
                Найти события
              </button>
            )}
          </div>
        ) : isMobileList ? (
          <EventList>
            {orderedEvents.map((event, idx) => (
              <Fragment key={event.id}>
                <PinHit onOpenMenu={(x, y) => openMenu(event, x, y)}>
                  {cancelledLabel(event) ? (
                    <div className={styles.cancelledHost}>
                      <div className={styles.cancelledGray}>
                        <EventListItem
                          event={event}
                          bleedCover
                          pinned={pinnedSet.has(event.id)}
                          onClick={() => navigate(`/event/${event.id}`)}
                          className={event.isOrganizer ? styles.cardOrganizer : undefined}
                          header={
                            event.isOrganizer ? (
                              <span className={styles.organizerTagInline}>Организатор</span>
                            ) : undefined
                          }
                        />
                      </div>
                      <div className={`${styles.cancelledOnPhoto} ${styles.cancelledOnPhotoRow}`}>
                        <span className={styles.cancelledPill}>{cancelledLabel(event)}</span>
                      </div>
                    </div>
                  ) : (
                    <EventListItem
                      event={event}
                      bleedCover
                      pinned={pinnedSet.has(event.id)}
                      onClick={() => navigate(`/event/${event.id}`)}
                      className={event.isOrganizer ? styles.cardOrganizer : undefined}
                      header={
                        event.isOrganizer ? (
                          <span className={styles.organizerTagInline}>Организатор</span>
                        ) : undefined
                      }
                    />
                  )}
                </PinHit>
                {shouldInsertAdAfterIndex(idx) && (
                  <AdSlot key={`ad-${event.id}`} />
                )}
              </Fragment>
            ))}
          </EventList>
        ) : (
          <div className={styles.grid}>
            {orderedEvents.map((event, idx) => (
              <Fragment key={event.id}>
                <PinHit className={styles.cardWrap} onOpenMenu={(x, y) => openMenu(event, x, y)}>
                  <div className={cancelledLabel(event) ? styles.cancelledGray : undefined}>
                    {event.isOrganizer && (
                      <span className={`${styles.organizerTag} ${pinnedSet.has(event.id) ? styles.organizerTagShifted : ''}`}>
                        Организатор
                      </span>
                    )}
                    <EventCard.Preset
                      event={event}
                      pinned={pinnedSet.has(event.id)}
                      onClick={() => navigate(`/event/${event.id}`)}
                      className={event.isOrganizer ? styles.cardOrganizer : undefined}
                    />
                  </div>
                  {cancelledLabel(event) && (
                    <div className={`${styles.cancelledOnPhoto} ${styles.cancelledOnPhotoCard}`}>
                      <span className={styles.cancelledPill}>{cancelledLabel(event)}</span>
                    </div>
                  )}
                </PinHit>
                {shouldInsertAdAfterIndex(idx) && (
                  <AdSlot key={`ad-${event.id}`} />
                )}
              </Fragment>
            ))}
          </div>
        )}

        {hasMore && (
          <div key={`${tab}-${ownerFilter}`} ref={sentinelRef} className={styles.sentinel}>
            {isLoadingMore && <span className={styles.loadingMore}>Загрузка...</span>}
          </div>
        )}
      </div>

      {menu && createPortal(
        <div
          ref={menuRef}
          className={styles.pinMenu}
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          <button type="button" className={styles.pinMenuItem} role="menuitem" onClick={toggleMenuPin}>
            <PinMenuGlyph />
            {pinnedSet.has(menu.eventId) ? 'Открепить' : 'Закрепить'}
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
