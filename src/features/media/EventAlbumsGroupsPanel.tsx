import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import {
  albumCoverFileIdsFromMeta,
  albumHasCoverPreview,
  albumHasNewContent,
  getAlbumsByEvents,
  getAlbumsByOrganizationEvents,
  getAlbumCoverFileIds,
  getAlbumFileCount,
  markAlbumViewed,
  presentAlbumGroupsFreshFirst,
  type IAlbum,
  type IEventAlbumsGroup,
} from '@/entities/media/albumApi';
import {
  formatEventListItemDate,
  getEventListCoverBackground,
  type EventListItemData,
} from '@/entities/event/lib/eventListItemUtils';
import { AlbumGridModal } from '@/features/media/AlbumGridModal';
import {
  groupHasUnreadAlbums,
  sortEventAlbumGroups,
  type AlbumListSort,
} from '@/features/media/albumListSort';
import { syncUnseenAlbums } from '@/features/media/albumFreshStore';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { AppPreloader } from '@/shared/ui/AppPreloader/AppPreloader';
import { coverFocusImgStyle } from '@/shared/lib/coverFocus';
import { useResolvedCoverFocus } from '@/entities/event/useResolvedCoverFocus';
import { media } from '@/shared/lib/breakpoints';
import { useInfiniteScroll, useMediaQuery } from '@/shared/hooks';
import {
  FLIP_STACK_ID,
  captureFlipRects,
  playFlipScatter,
  prefersReducedMotion,
  type FlipRects,
} from '@/features/media/albumFlip';
import {
  captureScrollAnchor,
  restoreScrollAnchor,
  type ScrollAnchorSnapshot,
} from '@/shared/lib/scrollAnchor';
import styles from './EventAlbumsGroupsPanel.module.css';

const PAGE_SIZE = 10;
const COLLAPSED_MAX = 5;
/** Overflow «ещё альбомы» на свёрнутой мобилке. */
const STACK_LAYER_MAX = 4;
/** Слои фото внутри одной миниатюры альбома (M1). */
const PHOTO_STACK_LAYERS = 3;

function albumCountLabel(count: number): string {
  if (count === 1) return '1 альбом';
  if (count < 5) return `${count} альбома`;
  return `${count} альбомов`;
}

function photoCountLabel(count: number): string {
  const n = Math.abs(Math.trunc(count));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} фотография`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} фотографии`;
  return `${count} фотографий`;
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
  photoTotal,
  onOpen,
}: {
  event: EventListItemData;
  photoTotal: number | null;
  onOpen: () => void;
}) {
  const coverBg = getEventListCoverBackground(event);
  const dateLabel = formatEventListItemDate(event.startTime);
  const focusStyle = coverFocusImgStyle(useResolvedCoverFocus(event));

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
        {(dateLabel || photoTotal != null) && (
          <div className={styles.eventDate}>
            {dateLabel && (
              <>
                <ClockIcon />
                {dateLabel}
              </>
            )}
            {photoTotal != null && (
              <span className={styles.photoTotal}>{photoCountLabel(photoTotal)}</span>
            )}
          </div>
        )}
      </div>
      <svg className={styles.eventChevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

function useAlbumCoverIds(album: IAlbum, limit: number): string[] {
  const [coverIds, setCoverIds] = useState<string[]>(() => (
    albumHasCoverPreview(album) ? albumCoverFileIdsFromMeta(album, limit) : []
  ));

  useEffect(() => {
    let cancelled = false;
    if (albumHasCoverPreview(album)) {
      setCoverIds(albumCoverFileIdsFromMeta(album, limit));
      return;
    }
    setCoverIds([]);
    getAlbumCoverFileIds(album.id, limit, album).then(ids => {
      if (!cancelled) setCoverIds(ids);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [album, limit]);

  return coverIds;
}

function CoverEmpty({ iconSize }: { iconSize: number }) {
  return (
    <div className={styles.albumCoverEmpty}>
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <circle cx="9" cy="15" r="2" />
        <path d="M14 13l3 4" />
      </svg>
    </div>
  );
}

function PrivateLock() {
  return (
    <div className={styles.privateBadge} aria-label="Приватный альбом">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    </div>
  );
}

/** Desktop D1: квадрат, мозаика первых фото, имя снизу, счётчик справа сверху. */
function AlbumCoverMosaic({
  album,
  iconSize,
}: {
  album: IAlbum;
  iconSize: number;
}) {
  const coverIds = useAlbumCoverIds(album, 4);
  const coverCount = coverIds.length;
  const showMosaic = coverCount > 1;
  const photoCount = album.photoCount;

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
              <AuthImage fileId={fileId} alt="" className={styles.albumCoverImg} preloader={false} />
            </div>
          ))}
        </div>
      ) : coverCount > 0 ? (
        <AuthImage fileId={coverIds[0]} alt="" className={styles.albumCoverImg} preloader={false} />
      ) : (
        <CoverEmpty iconSize={iconSize} />
      )}
      {photoCount != null && photoCount > 0 && (
        <span className={styles.photoCountBadge} title={photoCountLabel(photoCount)}>
          {photoCount}
        </span>
      )}
      {album.parameters?.private && <PrivateLock />}
      <div className={styles.albumCaption}>
        <div className={styles.albumCaptionName}>{album.name}</div>
      </div>
    </div>
  );
}

/** Mobile M1: диагональная стопка одиночных фото альбома (без мозаики). */
function AlbumPhotoStackThumb({
  album,
  onOpen,
}: {
  album: IAlbum;
  onOpen: () => void;
}) {
  const coverIds = useAlbumCoverIds(album, PHOTO_STACK_LAYERS);
  const fresh = albumHasNewContent(album);
  const layers = (coverIds.length > 0 ? coverIds : [null]).slice(0, PHOTO_STACK_LAYERS).reverse();

  return (
    <button
      type="button"
      className={fresh ? `${styles.photoStack} ${styles.photoStackFresh}` : styles.photoStack}
      onClick={onOpen}
      aria-label={album.name}
      title={album.name}
      data-album-flip-id={album.id}
      data-fresh={fresh ? 'true' : undefined}
    >
      <span className={styles.photoStackLayers} data-count={layers.length}>
        {layers.map((fileId, i) => (
          <span key={fileId ?? `empty-${i}`} className={styles.photoStackLayer}>
            {fileId ? (
              <AuthImage fileId={fileId} alt="" className={styles.albumCoverImg} preloader={false} />
            ) : (
              <CoverEmpty iconSize={16} />
            )}
          </span>
        ))}
      </span>
      {album.parameters?.private && <PrivateLock />}
    </button>
  );
}

function AlbumTile({
  album,
  onOpen,
}: {
  album: IAlbum;
  onOpen: () => void;
}) {
  const fresh = albumHasNewContent(album);
  const className = [
    styles.albumCard,
    fresh ? styles.albumCardFresh : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={className}
      onClick={onOpen}
      aria-label={album.name}
      title={album.name}
      data-album-flip-id={album.id}
      data-fresh={fresh ? 'true' : undefined}
    >
      <AlbumCoverMosaic album={album} iconSize={24} />
    </button>
  );
}

/** Overflow: стопка альбомов «ещё N» на свёрнутой мобилке. */
function AlbumStack({
  albums,
  extraCount,
  onOpen,
}: {
  albums: IAlbum[];
  extraCount: number;
  onOpen: () => void;
}) {
  const layers = albums.slice(0, STACK_LAYER_MAX);
  const fresh = albums.some(albumHasNewContent);
  const coverByAlbum = layers.map(album => ({
    album,
    // Одно фото на слой — без мозаики.
    ids: albumHasCoverPreview(album) ? albumCoverFileIdsFromMeta(album, 1) : [],
  }));

  return (
    <button
      type="button"
      className={fresh ? `${styles.photoStack} ${styles.photoStackFresh}` : styles.photoStack}
      onClick={onOpen}
      aria-label={`Ещё ${albumCountLabel(extraCount)}`}
      title={`Ещё ${albumCountLabel(extraCount)}`}
      data-album-flip-id={FLIP_STACK_ID}
      data-fresh={fresh ? 'true' : undefined}
    >
      <span className={styles.photoStackLayers} data-count={Math.min(coverByAlbum.length, PHOTO_STACK_LAYERS)}>
        {coverByAlbum.slice(0, PHOTO_STACK_LAYERS).reverse().map(({ album, ids }) => (
          <span key={album.id} className={styles.photoStackLayer}>
            {ids[0] ? (
              <AuthImage fileId={ids[0]} alt="" className={styles.albumCoverImg} preloader={false} />
            ) : (
              <CoverEmpty iconSize={14} />
            )}
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
  const albumIdsKey = albums.map(album => album.id).join('\0');
  const [photoTotal, setPhotoTotal] = useState<number | null>(null);
  const isMobile = useMediaQuery(media.mobile);
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const pendingFlipRef = useRef<FlipRects | null>(null);
  const pendingScrollRef = useRef<ScrollAnchorSnapshot | null>(null);
  const [flipBusy, setFlipBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ids = albumIdsKey ? albumIdsKey.split('\0') : [];
    setPhotoTotal(null);
    const publish = (total: number) => {
      if (!cancelled) setPhotoTotal(total);
    };
    if (ids.length === 0) {
      publish(0);
      return;
    }
    // Если byEvents уже отдал photoCount — без N× filesByAlbumId.
    if (albums.every(album => album.photoCount != null)) {
      publish(albums.reduce((sum, album) => sum + (album.photoCount ?? 0), 0));
      return;
    }
    Promise.all(ids.map(id => {
      const album = albums.find(item => item.id === id);
      if (album?.photoCount != null) return Promise.resolve(album.photoCount);
      return getAlbumFileCount(id).catch(() => 0);
    })).then(counts => {
      publish(counts.reduce((sum, count) => sum + count, 0));
    });
    return () => { cancelled = true; };
  }, [albumIdsKey, albums]);

  // Свёртка только на мобилке; на tablet/desktop всегда развёрнутые карточки.
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const expanded = !isMobile || mobileExpanded;
  const showStack = !expanded && albums.length > COLLAPSED_MAX;

  useLayoutEffect(() => {
    const scrollSnap = pendingScrollRef.current;
    if (scrollSnap) {
      pendingScrollRef.current = null;
      restoreScrollAnchor(scrollSnap, sectionRef.current);
    }

    const first = pendingFlipRef.current;
    const root = gridRef.current;
    if (!first || !root) return;
    pendingFlipRef.current = null;
    setFlipBusy(true);
    const order = albums.map(a => a.id);
    void playFlipScatter(root, first, order).finally(() => setFlipBusy(false));
  }, [expanded, albums]);

  const captureLayoutAnchors = () => {
    pendingScrollRef.current = captureScrollAnchor(sectionRef.current);
    const root = gridRef.current;
    if (root && !prefersReducedMotion()) {
      pendingFlipRef.current = captureFlipRects(root);
    }
  };

  const expand = () => {
    if (flipBusy || mobileExpanded) return;
    captureLayoutAnchors();
    setMobileExpanded(true);
  };

  const collapse = () => {
    if (flipBusy || !mobileExpanded) return;
    captureLayoutAnchors();
    setMobileExpanded(false);
  };

  const gridClass = [
    expanded ? styles.albumGrid : styles.albumGridCollapsed,
    flipBusy ? styles.albumGridFlip : '',
  ].filter(Boolean).join(' ');

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
          <AlbumPhotoStackThumb
            key={album.id}
            album={album}
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
      <AlbumPhotoStackThumb
        key={album.id}
        album={album}
        onOpen={expand}
      />
    ));
  }

  return (
    <section ref={sectionRef} className={styles.eventGroup}>
      <EventGroupHeader event={event} photoTotal={photoTotal} onOpen={() => onOpenEvent(event.id)} />
      <div ref={gridRef} className={gridClass}>
        {tiles}
      </div>
      {isMobile && mobileExpanded && (
        <button
          type="button"
          className={`${styles.collapseBtn} noHoverGlow`}
          onClick={collapse}
          disabled={flipBusy}
        >
          <ChevronUpIcon />
          <span className={styles.collapseTitle}>Свернуть</span>
          <ChevronUpIcon />
        </button>
      )}
    </section>
  );
}

/** Клиентский фильтр: по названию события или альбома/описанию. API не трогаем. */
export function filterEventAlbumGroups(
  groups: readonly IEventAlbumsGroup[],
  query: string,
): IEventAlbumsGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups.slice();
  const out: IEventAlbumsGroup[] = [];
  for (const group of groups) {
    const eventHit = group.event.name.toLowerCase().includes(q);
    if (eventHit) {
      out.push(group);
      continue;
    }
    const albums = group.albums.filter(album => {
      if (album.name.toLowerCase().includes(q)) return true;
      const description = album.description?.toLowerCase() ?? '';
      return description.includes(q);
    });
    if (albums.length > 0) out.push({ ...group, albums });
  }
  return out;
}

interface EventAlbumsGroupsPanelProps {
  /** Альбомы мероприятий, доступные аккаунту */
  accountId?: string;
  /** Альбомы мероприятий организации */
  organizationId?: string;
  onOpenEvent: (eventId: string) => void;
  onTotalChange?: (total: number) => void;
  /** Порядок плиток: для accountId уходит в byEvents?sort=; для org — клиентский fallback. */
  sort?: AlbumListSort;
  /**
   * Поднимать события с непросмотренными альбомами наверх.
   * По умолчанию true на странице альбомов; выкл. → чистая сортировка + только glow.
   */
  pinUnread?: boolean;
  /** Клиентский поиск по событию/альбому (без новых API). */
  searchQuery?: string;
  emptyTitle?: string;
  emptySub?: string;
  className?: string;
}

export function EventAlbumsGroupsPanel({
  accountId,
  organizationId,
  onOpenEvent,
  onTotalChange,
  sort,
  pinUnread = true,
  searchQuery = '',
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
  const [seenAlbumIds, setSeenAlbumIds] = useState<ReadonlySet<string>>(() => new Set());

  const scopeKey = organizationId ? `org:${organizationId}` : `acc:${accountId ?? ''}`;
  const hasScope = Boolean(organizationId || accountId);
  const hasMore = groups.length < total;
  /** Сервер сортирует только byEvents (аккаунт); орг. лента — клиентский fallback. */
  const serverSort = Boolean(accountId && !organizationId && sort);

  const fetchPage = useCallback(async (idx: number, append: boolean) => {
    if (!organizationId && !accountId) return;
    const data = organizationId
      ? await getAlbumsByOrganizationEvents(organizationId, idx, PAGE_SIZE)
      : await getAlbumsByEvents(accountId!, idx, PAGE_SIZE, sort ? { sort } : undefined);
    setGroups(prev => append ? [...prev, ...data.result] : data.result);
    if (!append) setSeenAlbumIds(new Set());
    setTotal(data.total);
    onTotalChange?.(data.total);
    setPageIndex(idx);
  }, [accountId, organizationId, onTotalChange, sort]);

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

  const sortedGroups = useMemo(() => {
    // Внутри события свежие альбомы всегда выше.
    const presented = presentAlbumGroupsFreshFirst(
      groups,
      seenAlbumIds,
      gridAlbum?.id ?? null,
      false,
    );

    // account + server sort: порядок с API; pinUnread только поднимает «новые» среди загруженных.
    // org / без sort: клиентский fallback по sort.
    const clientSortKey = serverSort ? null : (sort ?? null);
    if (!clientSortKey && !pinUnread) return presented;

    return sortEventAlbumGroups(
      presented,
      clientSortKey,
      pinUnread ? groupHasUnreadAlbums : undefined,
    );
  }, [groups, seenAlbumIds, gridAlbum, sort, pinUnread, serverSort]);

  const isSearching = Boolean(searchQuery.trim());
  const displayGroups = useMemo(
    () => filterEventAlbumGroups(sortedGroups, searchQuery),
    [sortedGroups, searchQuery],
  );

  // Поиск без нового API: догружаем остальные страницы byEvents, пока есть что грузить.
  useEffect(() => {
    if (!isSearching || !hasMore || loading || loadingMore) return;
    loadMore();
  }, [isSearching, hasMore, loading, loadingMore, groups.length, loadMore]);

  const rememberSeen = useCallback((albumId: string) => {
    setSeenAlbumIds(prev => {
      if (prev.has(albumId)) return prev;
      const next = new Set(prev);
      next.add(albumId);
      return next;
    });
  }, []);

  const openAlbum = useCallback((album: IAlbum) => {
    setGridAlbum(album);
    void markAlbumViewed(album.id).then(() => {
      rememberSeen(album.id);
      syncUnseenAlbums();
    }).catch(() => {});
  }, [rememberSeen]);

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

        {!loading && !error && groups.length === 0 && !isSearching && (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>{emptyTitle}</p>
            <p className={styles.emptySub}>{emptySub}</p>
          </div>
        )}

        {!loading && !error && isSearching && displayGroups.length === 0 && !hasMore && !loadingMore && (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>Ничего не найдено</p>
            <p className={styles.emptySub}>Попробуйте другое название мероприятия или альбома</p>
          </div>
        )}

        {!loading && displayGroups.map(group => (
          <EventGroupSection
            key={group.event.id}
            group={group}
            onOpenAlbum={openAlbum}
            onOpenEvent={onOpenEvent}
          />
        ))}

        {/* Пагинация: прелоадер/скелетон внизу ленты, где появятся новые группы */}
        {hasMore && !loading && (
          <div
            ref={isSearching ? undefined : sentinelRef}
            className={(loadingMore || isSearching) ? styles.loadMoreZone : styles.sentinel}
            aria-busy={loadingMore || isSearching || undefined}
          >
            {(loadingMore || (isSearching && hasMore)) && (
              <>
                <div className={styles.skeletonGroup} aria-hidden />
                <AppPreloader
                  layout="block"
                  size="sm"
                  aria-label="Загрузка альбомов"
                />
              </>
            )}
          </div>
        )}
      </div>

      <AlbumGridModal
        key={gridAlbum?.id ?? 'closed'}
        open={gridAlbum !== null}
        album={gridAlbum}
        canManage={false}
        onClose={() => setGridAlbum(null)}
      />
    </>
  );
}
