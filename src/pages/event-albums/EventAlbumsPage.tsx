import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccountId } from '@/features/auth/useAccountId';
import { AlbumSortMenu } from '@/features/media/AlbumSortMenu';
import {
  readStoredAlbumListSort,
  readStoredPinUnread,
  writeStoredAlbumListSort,
  writeStoredPinUnread,
  type AlbumListSort,
} from '@/features/media/albumListSort';
import { EventAlbumsGroupsPanel } from '@/features/media/EventAlbumsGroupsPanel';
import { useDebounce, usePageTitle } from '@/shared/hooks';
import styles from './EventAlbumsPage.module.css';

export default function EventAlbumsPage() {
  usePageTitle('Альбомы мероприятий');
  const navigate = useNavigate();
  const { accountId, loading } = useAccountId();
  const [sort, setSort] = useState<AlbumListSort>(() => readStoredAlbumListSort());
  const [pinUnread, setPinUnread] = useState(() => readStoredPinUnread(true));
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h1 className={styles.cardTitle}>Альбомы мероприятий</h1>
            {accountId && (
              <AlbumSortMenu
                value={sort}
                onChange={next => {
                  setSort(next);
                  writeStoredAlbumListSort(next);
                }}
                pinUnread={pinUnread}
                onPinUnreadChange={next => {
                  setPinUnread(next);
                  writeStoredPinUnread(next);
                }}
              />
            )}
          </div>

          {accountId && (
            <div className={styles.searchWrap}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.searchIcon} aria-hidden>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                className={styles.searchInput}
                type="search"
                placeholder="Поиск по мероприятию или альбому..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                aria-label="Поиск по мероприятию или альбому"
              />
              {search && (
                <button
                  type="button"
                  className={styles.searchClear}
                  onClick={() => setSearch('')}
                  aria-label="Очистить поиск"
                >
                  ×
                </button>
              )}
            </div>
          )}

          <div className={styles.cardBody}>
            {!loading && !accountId && (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>Войдите в аккаунт</p>
                <p className={styles.emptySub}>Чтобы увидеть альбомы мероприятий, в которых вы участвуете</p>
              </div>
            )}

            {accountId && (
              <EventAlbumsGroupsPanel
                accountId={accountId}
                onOpenEvent={eventId => navigate(`/event/${eventId}`)}
                sort={sort}
                pinUnread={pinUnread}
                searchQuery={debouncedSearch}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
