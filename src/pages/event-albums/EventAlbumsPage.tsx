// pages/event-albums/EventAlbumsPage.tsx

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAlbumsByEvents,
  getAlbumFiles,
  type IAlbum,
  type IEventAlbumsGroup,
} from '@/entities/media/albumApi';
import { AlbumGridModal } from '@/features/media/AlbumGridModal';
import { useAccountId } from '@/features/auth/useAccountId';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { buildEventCoverBackground } from '@/shared/lib/eventCoverGradient';
import { useInfiniteScroll } from '@/shared/hooks';
import styles from './EventAlbumsPage.module.css';

const PAGE_SIZE = 10;

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function AlbumTile({ album, onOpen }: { album: IAlbum; onOpen: () => void }) {
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAlbumFiles(album.id, 1, 1).then(files => {
      if (!cancelled && files.length > 0) setCover(files[0].fileId);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [album.id]);

  return (
    <button type="button" className={styles.albumCard} onClick={onOpen}>
      <div className={styles.albumCover}>
        {cover
          ? <AuthImage fileId={cover} alt="" className={styles.albumCoverImg} />
          : (
            <div className={styles.albumCoverEmpty}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
                <circle cx="9" cy="15" r="2" />
                <path d="M14 13l3 4" />
              </svg>
            </div>
          )}
        {album.parameters?.private && (
          <div className={styles.privateBadge} aria-label="Приватный альбом">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
        )}
      </div>
      <div className={styles.albumMeta}>
        <div className={styles.albumName}>{album.name}</div>
        {album.description && <div className={styles.albumDesc}>{album.description}</div>}
      </div>
    </button>
  );
}

function EventGroupSection({
  group,
  onOpenAlbum,
  onOpenEvent,
}: {
  group: IEventAlbumsGroup;
  onOpenAlbum: (album: IAlbum) => void;
  onOpenEvent: (eventId: string) => void;
}) {
  const { event, albums } = group;
  const coverBg = buildEventCoverBackground(event.id, event.colors);

  return (
    <section className={styles.eventGroup}>
      <button type="button" className={styles.eventHeader} onClick={() => onOpenEvent(event.id)}>
        <div className={styles.eventCover} style={{ background: coverBg }} aria-hidden />
        <div className={styles.eventInfo}>
          <div className={styles.eventName}>{event.name}</div>
          <div className={styles.eventDate}>{formatEventDate(event.startTime)}</div>
          <div className={styles.eventAlbumCount}>
            {albums.length} {albums.length === 1 ? 'альбом' : albums.length < 5 ? 'альбома' : 'альбомов'}
          </div>
        </div>
        <svg className={styles.eventChevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      <div className={styles.albumGrid}>
        {albums.map(album => (
          <AlbumTile key={album.id} album={album} onOpen={() => onOpenAlbum(album)} />
        ))}
      </div>
    </section>
  );
}

export default function EventAlbumsPage() {
  const navigate = useNavigate();
  const { accountId, loading: accountLoading } = useAccountId();
  const [groups, setGroups] = useState<IEventAlbumsGroup[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gridAlbum, setGridAlbum] = useState<IAlbum | null>(null);

  const hasMore = groups.length < total;

  const fetchPage = useCallback(async (idx: number, append: boolean) => {
    if (!accountId) return;
    const data = await getAlbumsByEvents(accountId, idx, PAGE_SIZE);
    setGroups(prev => append ? [...prev, ...data.result] : data.result);
    setTotal(data.total);
    setPageIndex(idx);
  }, [accountId]);

  useEffect(() => {
    if (accountLoading) return;
    if (!accountId) {
      setLoading(false);
      setGroups([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    setError(null);
    fetchPage(0, false)
      .catch(() => setError('Не удалось загрузить альбомы'))
      .finally(() => setLoading(false));
  }, [accountId, accountLoading, fetchPage]);

  const loadMore = useCallback(() => {
    if (!accountId || loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    fetchPage(pageIndex + 1, true)
      .catch(() => setError('Не удалось загрузить ещё'))
      .finally(() => setLoadingMore(false));
  }, [accountId, loadingMore, loading, hasMore, pageIndex, fetchPage]);

  const sentinelRef = useInfiniteScroll(loadMore, { enabled: hasMore && !loading && !loadingMore });

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h1 className={styles.cardTitle}>Альбомы мероприятий</h1>
            {!loading && groups.length > 0 && (
              <span className={styles.badge}>{total}</span>
            )}
          </div>

          <div className={styles.cardBody}>
            {loading && (
              <div className={styles.skeletons}>
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className={styles.skeletonGroup} />
                ))}
              </div>
            )}

            {!loading && !accountId && (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>Войдите в аккаунт</p>
                <p className={styles.emptySub}>Чтобы увидеть альбомы мероприятий, в которых вы участвуете</p>
              </div>
            )}

            {error && <div className={styles.error}>{error}</div>}

            {!loading && accountId && !error && groups.length === 0 && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📷</div>
                <p className={styles.emptyTitle}>Альбомов пока нет</p>
                <p className={styles.emptySub}>Здесь появятся фотоальбомы мероприятий, к которым у вас есть доступ</p>
              </div>
            )}

            {!loading && groups.map(group => (
              <EventGroupSection
                key={group.event.id}
                group={group}
                onOpenAlbum={setGridAlbum}
                onOpenEvent={id => navigate(`/event/${id}`)}
              />
            ))}

            {hasMore && !loading && <div ref={sentinelRef} className={styles.sentinel} aria-hidden />}
            {loadingMore && <div className={styles.loadingMore}>Загрузка...</div>}
          </div>
        </div>
      </div>

      <AlbumGridModal
        open={gridAlbum !== null}
        album={gridAlbum}
        canManage={false}
        onClose={() => setGridAlbum(null)}
      />
    </div>
  );
}
