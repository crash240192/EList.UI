import { useNavigate } from 'react-router-dom';
import { useAccountId } from '@/features/auth/useAccountId';
import { EventAlbumsGroupsPanel } from '@/features/media/EventAlbumsGroupsPanel';
import { usePageTitle } from '@/shared/hooks';
import styles from './EventAlbumsPage.module.css';

export default function EventAlbumsPage() {
  usePageTitle('Альбомы мероприятий');
  const navigate = useNavigate();
  const { accountId, loading } = useAccountId();

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h1 className={styles.cardTitle}>Альбомы мероприятий</h1>
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
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
