import { useState, useEffect, useCallback } from 'react';
import {
  getAlbumsByEvents,
  getAlbumsByOrganizationEvents,
  getAlbumFiles,
  type IAlbum,
  type IEventAlbumsGroup,
} from '@/entities/media/albumApi';
import {
  formatEventListItemDate,
  getEventListCoverBackground,
  type EventListItemData,
} from '@/entities/event/lib/eventListItemUtils';
import { AlbumGridModal } from '@/features/media/AlbumGridModal';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { coverFocusFromEvent, coverFocusImgStyle } from '@/shared/lib/coverFocus';
import { media } from '@/shared/lib/breakpoints';
import { useInfiniteScroll, useMediaQuery } from '@/shared/hooks';
import styles from './EventAlbumsGroupsPanel.module.css';

const PAGE_SIZE = 10;
const COLLAPSED_MAX = 5;
const STACK_LAYER_MAX = 4;

function albumCountLabel(count: number): string {
  if (count === 1) return '1 альбом';
  if (count < 5) return `${count} альбома`;
  return `${count} альбомов`;
}

function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function EventGroupHeader({
  event,
  onOpen,
}: {
  event: EventListItemData;
  onOpen: () => void;
}) {
  const coverBg = getEventListCoverBackground(event);
  const dateLabel = formatEventListItemDate(event.startTime);
  const focusStyle = coverFocusImgStyle(coverFocusFromEvent(event));

  return (
    <button type="button" className={styles.eventHeader} onClick={onOpen}>
      <div className={styles.eventCover} style={{ background: coverBg }}>
        {event.coverImageId ? (
          <AuthImage
            fileId={event.coverImageId}
            alt=""
            className={styles.eventCoverImg}
            style={focusStyle}
            fallback={
              event.coverUrl
                ? <img src={event.coverUrl} alt="" className={styles.eventCoverImg} style={focusStyle} />
                : null
            }
          />
        ) : event.coverUrl ? (
          <img src={event.coverUrl} alt="" className={styles.eventCoverImg} style={focusStyle} />
        ) : null}
      </div>
      <div className={styles.eventInfo}>
        <div className={styles.eventName}>{event.name}</div>
        {dateLabel && (
          <div className={styles.eventDate}>
            <ClockIcon />
            {dateLabel}
          </div>
        )}
      </div>
      <svg className={styles.eventChevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

function AlbumCover({
  album,
  iconSize,
  mosaic = false,
}: {
  album: IAlbum;
  iconSize: number;
  /** Развёрнутая карточка: сетка до 4 первых фото */
  mosaic?: boolean;
}) {
  const [coverIds, setCoverIds] = useState<string[]>([]);
  const previewLimit = mosaic ? 4 : 1;

  useEffect(() => {
    let cancelled = false;
    setCoverIds([]);
    getAlbumFiles(album.id, 1, previewLimit).then(files => {
      if (cancelled) return;
      setCoverIds(files.slice(0, previewLimit).map(f => f.fileId).filter(Boolean));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [album.id, previewLimit]);

  const coverCount = coverIds.length;
  const showMosaic = mosaic && coverCount > 1;

  return (
    <div className={styles.albumCover}>
      {showMosaic ? (
        <div
          className={styles.albumCoverMosaic}
          data-count={Math.min(coverCount, 4)}
          aria-hidden
        >
          {coverIds.slice(0, 4).map((fileId, i) => (
            <div key={`${fileId}-${i}`} className={styles.albumCoverMosaicCell}>
              <AuthImage fileId={fileId} alt="" className={styles.albumCoverImg} />
            </div>
          ))}
        </div>
      ) : coverCount > 0 ? (
        <AuthImage fileId={coverIds[0]} alt="" className={styles.albumCoverImg} />
      ) : (
        <div className={styles.albumCoverEmpty}>
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
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
  );
}

function AlbumTile({
  album,
  compact,
  onOpen,
}: {
  album: IAlbum;
  compact?: boolean;
  onOpen: () => void;
}) {
  const iconSize = compact ? 16 : 24;
  const className = [
    styles.albumCard,
    compact ? styles.albumCardThumb : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={className}
      onClick={onOpen}
      aria-label={compact ? album.name : undefined}
      title={compact ? album.name : undefined}
    >
      <AlbumCover album={album} iconSize={iconSize} mosaic={!compact} />
      {!compact && (
        <div className={styles.albumMeta}>
          <div className={styles.albumName}>{album.name}</div>
          {album.description && <div className={styles.albumDesc}>{album.description}</div>}
        </div>
      )}
    </button>
  );
}

function AlbumStack({
  albums,
  extraCount,
  onOpen,
}: {
  albums: IAlbum[];
  extraCount: number;
  onOpen: () => void;
}) {
  const layers = albums.slice(0, STACK_LAYER_MAX).reverse();

  return (
    <button
      type="button"
      className={styles.stackThumb}
      onClick={onOpen}
      aria-label={`Ещё ${albumCountLabel(extraCount)}`}
      title={`Ещё ${albumCountLabel(extraCount)}`}
    >
      <span className={styles.stackThumbLayers}>
        {layers.map(album => (
          <span key={album.id} className={styles.stackThumbLayer}>
            <AlbumCover album={album} iconSize={14} />
          </span>
        ))}
      </span>
      {extraCount > 0 && (
        <span className={styles.stackThumbPlus}>+{extraCount}</span>
      )}
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
  const isMobile = useMediaQuery(media.mobile);
  // Свёртка только на мобилке; на tablet/desktop всегда развёрнутые карточки.
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const expanded = !isMobile || mobileExpanded;
  const showStack = !expanded && albums.length > COLLAPSED_MAX;
  const expand = () => setMobileExpanded(true);

  const gridClass = expanded ? styles.albumGrid : styles.albumGridCollapsed;

  let tiles;
  if (expanded) {
    tiles = albums.map(album => (
      <AlbumTile
        key={album.id}
        album={album}
        onOpen={() => onOpenAlbum(album)}
      />
    ));
  } else if (showStack) {
    const head = albums.slice(0, COLLAPSED_MAX - 1);
    const rest = albums.slice(COLLAPSED_MAX - 1);
    tiles = (
      <>
        {head.map(album => (
          <AlbumTile
            key={album.id}
            album={album}
            compact
            onOpen={expand}
          />
        ))}
        <AlbumStack
          albums={rest}
          extraCount={albums.length - COLLAPSED_MAX}
          onOpen={expand}
        />
      </>
    );
  } else {
    tiles = albums.map(album => (
      <AlbumTile
        key={album.id}
        album={album}
        compact
        onOpen={expand}
      />
    ));
  }

  return (
    <section className={styles.eventGroup}>
      <EventGroupHeader event={event} onOpen={() => onOpenEvent(event.id)} />
      <div className={gridClass}>
        {tiles}
      </div>
      {isMobile && mobileExpanded && (
        <button
          type="button"
          className={`${styles.collapseBtn} noHoverGlow`}
          onClick={() => setMobileExpanded(false)}
        >
          <ChevronUpIcon />
          <span className={styles.collapseTitle}>Свернуть</span>
          <ChevronUpIcon />
        </button>
      )}
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
