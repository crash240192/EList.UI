import { useState, useEffect, useCallback } from 'react';
import {
  getAlbumsByEvents,
  getAlbumsByOrganizationEvents,
  getAlbumFiles,
  type IAlbum,
  type IEventAlbumsGroup,
} from '@/entities/media/albumApi';
import { EventListItem } from '@/entities/event/ui/EventListItem';
import { AlbumGridModal } from '@/features/media/AlbumGridModal';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { useInfiniteScroll } from '@/shared/hooks';
import styles from './EventAlbumsGroupsPanel.module.css';

const PAGE_SIZE = 10;

function albumCountLabel(count: number): string {
  if (count === 1) return '1 альбом';
  if (count < 5) return `${count} альбома`;
  return `${count} альбомов`;
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
                <circle cx="9" cy="15" r="2" />
                <path d="M14 13l3 4" />
              </svg>
            </div>
          )}
        {album.parameters?.private && (
          <div className={styles.privateBadge} aria-label="Приватный альбом">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
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

  return (
    <section className={styles.eventGroup}>
      <EventListItem
        event={event}
        onClick={() => onOpenEvent(event.id)}
        showChevron
        bleedCover
        footer={<span>{albumCountLabel(albums.length)}</span>}
      />
      <div className={styles.albumGrid}>
        {albums.map(album => (
          <AlbumTile key={album.id} album={album} onOpen={() => onOpenAlbum(album)} />
        ))}
      </div>
    </section>
  );
}

interface EventAlbumsGroupsPanelProps {
  /** Альбомы мероприятий, доступные аккаунту */
  accountId?: string;
  /** Альбомы мероприятий организации */
  organizationId?: string;
  onOpenEvent: (eventId: string) => void;
  onTotalChange?: (total: number) => void;
  emptyTitle?: string;
  emptySub?: string;
  className?: string;
}

export function EventAlbumsGroupsPanel({
  accountId,
  organizationId,
  onOpenEvent,
  onTotalChange,
  emptyTitle = 'Альбомов пока нет',
  emptySub = 'Здесь появятся фотоальбомы мероприятий, к которым есть доступ',
  className,
}: EventAlbumsGroupsPanelProps) {
  const [groups, setGroups] = useState<IEventAlbumsGroup[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gridAlbum, setGridAlbum] = useState<IAlbum | null>(null);

  const scopeKey = organizationId ? `org:${organizationId}` : `acc:${accountId ?? ''}`;
  const hasScope = Boolean(organizationId || accountId);
  const hasMore = groups.length < total;

  const fetchPage = useCallback(async (idx: number, append: boolean) => {
    if (!organizationId && !accountId) return;
    const data = organizationId
      ? await getAlbumsByOrganizationEvents(organizationId, idx, PAGE_SIZE)
      : await getAlbumsByEvents(accountId!, idx, PAGE_SIZE);
    setGroups(prev => append ? [...prev, ...data.result] : data.result);
    setTotal(data.total);
    onTotalChange?.(data.total);
    setPageIndex(idx);
  }, [accountId, organizationId, onTotalChange]);

  useEffect(() => {
    if (!hasScope) {
      setLoading(false);
      setGroups([]);
      setTotal(0);
      onTotalChange?.(0);
      return;
    }

    setLoading(true);
    setError(null);
    fetchPage(0, false)
      .catch(() => setError('Не удалось загрузить альбомы'))
      .finally(() => setLoading(false));
  }, [scopeKey, hasScope, fetchPage, onTotalChange]);

  const loadMore = useCallback(() => {
    if (!hasScope || loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    fetchPage(pageIndex + 1, true)
      .catch(() => setError('Не удалось загрузить ещё'))
      .finally(() => setLoadingMore(false));
  }, [hasScope, loadingMore, loading, hasMore, pageIndex, fetchPage]);

  const sentinelRef = useInfiniteScroll(loadMore, { enabled: hasMore && !loading && !loadingMore });

  return (
    <>
      <div className={`${styles.panel} ${className ?? ''}`}>
        {loading && (
          <div className={styles.skeletons}>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className={styles.skeletonGroup} />
            ))}
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        {!loading && !error && groups.length === 0 && (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>{emptyTitle}</p>
            <p className={styles.emptySub}>{emptySub}</p>
          </div>
        )}

        {!loading && groups.map(group => (
          <EventGroupSection
            key={group.event.id}
            group={group}
            onOpenAlbum={setGridAlbum}
            onOpenEvent={onOpenEvent}
          />
        ))}

        {hasMore && !loading && <div ref={sentinelRef} className={styles.sentinel} aria-hidden />}
        {loadingMore && <div className={styles.loadingMore}>Загрузка...</div>}
      </div>

      <AlbumGridModal
        open={gridAlbum !== null}
        album={gridAlbum}
        canManage={false}
        onClose={() => setGridAlbum(null)}
      />
    </>
  );
}
