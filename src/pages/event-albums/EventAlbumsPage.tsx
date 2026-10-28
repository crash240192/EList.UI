import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccountId } from '@/features/auth/useAccountId';
import { AlbumSortMenu } from '@/features/media/AlbumSortMenu';
import { DEFAULT_ALBUM_LIST_SORT, type AlbumListSort } from '@/features/media/albumListSort';
import { EventAlbumsGroupsPanel } from '@/features/media/EventAlbumsGroupsPanel';
import { usePageTitle } from '@/shared/hooks';
import styles from './EventAlbumsPage.module.css';

export default function EventAlbumsPage() {
  usePageTitle('Альбомы мероприятий');
  const navigate = useNavigate();
  const { accountId, loading } = useAccountId();
  const [sort, setSort] = useState<AlbumListSort>(DEFAULT_ALBUM_LIST_SORT);

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h1 className={styles.cardTitle}>Альбомы мероприятий</h1>
            {accountId && <AlbumSortMenu value={sort} onApply={setSort} />}
          </div>

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
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
