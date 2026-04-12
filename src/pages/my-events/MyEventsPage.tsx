// pages/my-events/MyEventsPage.tsx

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { EventCard } from '@/entities/event';
import { useEvents } from '@/features/event-list/useEvents';
import { useFavoritesStore } from '@/app/store';
import { useAccountId } from '@/features/auth/useAccountId';
import { useInfiniteScroll } from '@/shared/hooks';
import type { IEventsSearchParams } from '@/entities/event';
import styles from './MyEventsPage.module.css';

type Tab          = 'active' | 'archive';
type OwnerFilter  = 'all' | 'mine' | 'others';

export default function MyEventsPage() {
  const navigate = useNavigate();
  const { toggle: toggleFav, isFavorite } = useFavoritesStore();
  const { accountId, loading: accountLoading } = useAccountId();

  const [tab, setTab]               = useState<Tab>('active');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');

  const now = new Date().toISOString();

  // Собираем параметры поиска в зависимости от фильтра
  const params = useMemo<IEventsSearchParams>(() => {
    if (!accountId) return {};

    const timeFilter: Partial<IEventsSearchParams> =
      tab === 'archive' ? { endTime: now } : {};

    switch (ownerFilter) {
      case 'mine':
        return { ...timeFilter, organizatorId: accountId };
      case 'others':
        return { ...timeFilter, participantId: accountId };
      case 'all':
      default:
        // Один запрос с обоими параметрами — сервер возвращает события
        // где пользователь является либо организатором, либо участником
        return { ...timeFilter, organizatorId: accountId, participantId: accountId };
    }
  }, [accountId, tab, ownerFilter, now]);

  const { events, isLoading, isLoadingMore, hasMore, loadMore } = useEvents(params);
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

      {/* ---- Owner filter ---- */}
      <div className={styles.ownerFilter}>
        {(['all', 'mine', 'others'] as OwnerFilter[]).map(f => (
          <button
            key={f}
            className={`${styles.filterChip} ${ownerFilter === f ? styles.filterChipActive : ''}`}
            onClick={() => setOwnerFilter(f)}
          >
            {{ all: 'Все', mine: 'Мои', others: 'Подписки' }[f]}
          </button>
        ))}
      </div>

      {/* ---- Tabs ---- */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'active' ? styles.tabActive : ''}`}
          onClick={() => setTab('active')}
        >
          Активные
        </button>
        <button
          className={`${styles.tab} ${tab === 'archive' ? styles.tabActive : ''}`}
          onClick={() => setTab('archive')}
        >
          Архив
        </button>
      </div>

      {/* ---- List ---- */}
      <div className={styles.list}>
        {!isReady || isLoading ? (
          // Skeleton
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeleton} />
          ))
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
          events.map(event => (
            <div
              key={event.id}
              className={`${styles.cardWrap} ${event.isOrganizer ? styles.cardOrganizer : ''}`}
            >
              {event.isOrganizer && (
                <span className={styles.organizerTag}>Организатор</span>
              )}
              <EventCard.Preset
                event={event}
                onClick={() => navigate(`/event/${event.id}`)}
                isFavorite={isFavorite(event.id)}
                onFavorite={toggleFav}
              />
            </div>
          ))
        )}

        {/* Infinite scroll sentinel */}
        {hasMore && (
          <div ref={sentinelRef} className={styles.sentinel}>
            {isLoadingMore && <span className={styles.loadingMore}>Загрузка...</span>}
          </div>
        )}
      </div>
    </div>
  );
}
