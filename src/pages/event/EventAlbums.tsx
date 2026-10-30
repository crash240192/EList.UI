// pages/event/EventAlbums.tsx
// Блок альбомов на странице мероприятия

import { useState, useEffect, useCallback, useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  albumHasNewContent,
  getEventAlbums,
  getAlbumFiles,
  getAlbumCoverPreview,
  assignAlbumToEvent,
  deleteAlbum,
  markAlbumViewed,
  presentAlbumsFreshFirst,
  type IAlbum,
} from '@/entities/media/albumApi';
import { canManageAlbum } from '@/entities/media/albumPermissions';
import { AlbumFormModal } from '@/features/media/AlbumFormModal';
import { AlbumGridModal } from '@/features/media/AlbumGridModal';
import { syncUnseenAlbums } from '@/features/media/albumFreshStore';
import {
  FLIP_STACK_ID,
  captureFlipRects,
  playFlipScatter,
  prefersReducedMotion,
  type FlipRects,
} from '@/features/media/albumFlip';
import {
  captureScrollTop,
  restoreScrollTop,
  type ScrollTopSnapshot,
} from '@/shared/lib/scrollAnchor';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { AccessDeniedGate } from '@/shared/ui/AccessDenied/AccessDeniedGate';
import { isAccessDeniedError } from '@/shared/api/apiErrorUtils';
import { media } from '@/shared/lib/breakpoints';
import { useMediaQuery } from '@/shared/hooks';
import styles from './EventAlbums.module.css';

// ── Изображение со спиннером ─────────────────────────────────────────────────
function SpinnerImage({
  fileId,
  alt,
  className,
  fullSize = false,
}: { fileId: string; alt?: string; className?: string; fullSize?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useLayoutEffect(() => {
    setLoaded(false);
    setError(false);
  }, [fileId, fullSize]);

  const ownSpinner = !fullSize;

  return (
    <div className={styles.imgWrap} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {ownSpinner && !loaded && !error && (
        <div className={styles.imgSpinner}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ animation: 'spin 1s linear infinite' }}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        </div>
      )}
      {error ? (
        <div className={styles.imgError}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v6"/>
          </svg>
        </div>
      ) : (
        <AuthImage
          fileId={fileId}
          fullSize={fullSize}
          alt={alt ?? ''}
          className={`${className ?? styles.img} ${fullSize || loaded ? styles.imgLoaded : styles.imgHidden}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      )}
    </div>
  );
}

// ── Диалог подтверждения удаления ─────────────────────────────────────────────
function DeleteAlbumDialog({ title, text, confirmLabel, loading, onConfirm, onClose }: {
  title: string; text: string; confirmLabel: string; loading: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return createPortal(
    <>
      <div className={styles.dialogBackdrop} onClick={onClose} />
      <div className={styles.dialog} role="dialog" aria-modal>
        <div className={styles.dialogTitle}>{title}</div>
        <div className={styles.dialogText}>{text}</div>
        <div className={styles.dialogBtns}>
          <button type="button" className={styles.dialogCancel} onClick={onClose} disabled={loading}>Отмена</button>
          <button type="button" className={styles.dialogDelete} onClick={onConfirm} disabled={loading}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

// ── Карточка альбома ──────────────────────────────────────────────────────────
interface AlbumCardProps {
  album: IAlbum;
  canManage: boolean;
  coverVersion?: number;
  hideMeta?: boolean;
  /** Правый край растворяется, если за плиткой ещё есть альбомы. */
  fadeRight?: boolean;
  /** Сколько альбомов не влезло — подпись «+N» поверх этой плитки. */
  overflowCount?: number;
  /** FLIP id (album.id или FLIP_STACK_ID). */
  flipId?: string;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function AlbumCard({
  album,
  canManage,
  coverVersion = 0,
  hideMeta = false,
  fadeRight = false,
  overflowCount = 0,
  flipId,
  onOpen,
  onEdit,
  onDelete,
}: AlbumCardProps) {
  const [coverIds, setCoverIds] = useState<string[]>([]);
  const [photoCount, setPhotoCount] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuElRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: 'hidden' });

  // Свёрнутые M1 — до 3 одиночных кадров в стопку; D1 — до 4 для мозаики.
  const previewLimit = hideMeta ? 3 : 4;

  useEffect(() => {
    let cancelled = false;
    // Не очищаем обложки при росте previewLimit (свёртка→разворот) — иначе моргание.
    getAlbumCoverPreview(album.id, previewLimit, album).then(({ fileIds, total }) => {
      if (!cancelled) {
        setCoverIds(fileIds);
        setPhotoCount(total);
      }
    }).catch(() => {
      if (!cancelled) setPhotoCount(0);
    });
    return () => { cancelled = true; };
  }, [album, coverVersion, previewLimit]);

  useEffect(() => {
    // Смена альбома / версии обложки — сброс до прихода новых превью.
    setCoverIds([]);
    setPhotoCount(null);
  }, [album.id, coverVersion]);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuStyle({ visibility: 'hidden' });
      return;
    }

    const place = () => {
      const btn = menuBtnRef.current;
      const menu = menuElRef.current;
      if (!btn || !menu) return;
      const pad = 8;
      const gap = 4;
      const rect = btn.getBoundingClientRect();
      const mw = menu.offsetWidth;
      const mh = menu.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = rect.right - mw;
      if (left < pad) left = pad;
      if (left + mw > vw - pad) left = Math.max(pad, vw - pad - mw);

      let top = rect.bottom + gap;
      if (top + mh > vh - pad) {
        const above = rect.top - gap - mh;
        top = above >= pad ? above : Math.max(pad, vh - pad - mh);
      }

      setMenuStyle({ top, left, visibility: 'visible' });
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [menuOpen]);

  const coverCount = coverIds.length;
  const showMosaic = !hideMeta && coverCount > 1;
  const fresh = albumHasNewContent(album);
  // Collapsed M1: диагональная стопка до 3 одиночных кадров.
  const stackLayers = (coverCount > 0 ? coverIds : [null as string | null])
    .slice(0, 3)
    .reverse();

  return (
    <div
      className={styles.albumTile}
      data-album-flip-id={flipId}
    >
      <div
        className={`${styles.albumCard} ${hideMeta ? styles.albumCardThumb : styles.albumCardD1} ${fadeRight ? styles.albumCardFadeRight : ''} ${fresh ? styles.albumCardFresh : ''}`}
        data-fresh={fresh ? 'true' : undefined}
        data-album-name={album.name}
      >
      <div className={styles.albumCardBody} onClick={onOpen} role="button" tabIndex={0}
        aria-label={album.name}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}>
        {hideMeta ? (
          <span className={styles.photoStackLayers} data-count={stackLayers.length}>
            {stackLayers.map((fileId, i) => (
              <span key={fileId ?? `empty-${i}`} className={styles.photoStackLayer}>
                {fileId ? (
                  <SpinnerImage fileId={fileId} alt="" className={styles.albumCoverImg} />
                ) : (
                  <div className={styles.albumCoverEmpty}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>
                      <circle cx="9" cy="15" r="2"/><path d="M14 13l3 4"/>
                    </svg>
                  </div>
                )}
              </span>
            ))}
            {album.parameters?.private && (
              <div className={styles.privateBadge}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
              </div>
            )}
          </span>
        ) : (
          <div className={styles.albumCover}>
            {showMosaic ? (
              <div
                className={styles.albumCoverMosaic}
                data-count={Math.min(coverCount, 4)}
                aria-hidden
              >
                {coverIds.slice(0, 4).map((fileId, i) => (
                  <div key={`${fileId}-${i}`} className={styles.albumCoverMosaicCell}>
                    <SpinnerImage fileId={fileId} alt="" className={styles.albumCoverImg} />
                  </div>
                ))}
              </div>
            ) : coverCount > 0 ? (
              <SpinnerImage fileId={coverIds[0]} alt={album.name} className={styles.albumCoverImg} />
            ) : (
              <div className={styles.albumCoverEmpty}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>
                  <circle cx="9" cy="15" r="2"/><path d="M14 13l3 4"/>
                </svg>
              </div>
            )}
            {album.parameters?.private && (
              <div className={styles.privateBadge}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
              </div>
            )}
            {photoCount != null && photoCount > 0 && (
              <span className={styles.photoCountBadge} title={`${photoCount}`}>
                {photoCount}
              </span>
            )}
            <div className={styles.albumCaption}>
              <div className={styles.albumCaptionName}>{album.name}</div>
            </div>
          </div>
        )}
      </div>
      </div>

      {overflowCount > 0 && (
        <span className={styles.albumOverflowCount} aria-hidden>+{overflowCount}</span>
      )}

      {canManage && !hideMeta && (
        <div className={styles.albumMenuWrap}>
          <button
            ref={menuBtnRef}
            type="button"
            className={styles.albumMenuBtn}
            aria-label="Меню альбома"
            aria-expanded={menuOpen}
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
            </svg>
          </button>
          {menuOpen && createPortal(
            <>
              <div className={styles.albumMenuBackdrop} onClick={() => setMenuOpen(false)} aria-hidden />
              <div
                ref={menuElRef}
                className={styles.albumMenu}
                style={menuStyle}
                role="menu"
              >
                <button type="button" className={styles.albumMenuItem} role="menuitem"
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); onEdit(); }}>
                  Редактировать
                </button>
                <button type="button" className={`${styles.albumMenuItem} ${styles.albumMenuItemDanger}`} role="menuitem"
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}>
                  Удалить
                </button>
              </div>
            </>,
            document.body,
          )}
        </div>
      )}
    </div>
  );
}

function AddAlbumThumb({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={styles.addAlbumThumb} onClick={onClick} aria-label="Добавить альбом">
      <span className={styles.addAlbumThumbIcon}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </span>
    </button>
  );
}

function AddAlbumCard({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={`${styles.addAlbumCard} ${styles.albumCardD1}`} onClick={onClick}>
      <div className={`${styles.albumCover} ${styles.addAlbumCover}`}>
        <div className={styles.addAlbumIcon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </div>
        <div className={styles.albumCaption}>
          <div className={styles.albumCaptionName}>Добавить альбом</div>
        </div>
      </div>
    </button>
  );
}

// ── Основной блок ──────────────────────────────────────────────────────────────
interface EventAlbumsProps {
  eventId: string;
  compact?: boolean;
  canManage?: boolean;
  isParticipating?: boolean;
  accountId?: string | null;
}

export function EventAlbums({
  eventId,
  compact,
  canManage = false,
  isParticipating = false,
  accountId = null,
}: EventAlbumsProps) {
  const [albums,  setAlbums]  = useState<IAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [gridAlbum, setGridAlbum] = useState<IAlbum | null>(null);
  const [formAlbum, setFormAlbum] = useState<IAlbum | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<IAlbum | null>(null);
  const [deleteStage, setDeleteStage] = useState<'confirm' | 'photos'>('confirm');
  const [checkingPhotos, setCheckingPhotos] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [coverVersionByAlbumId, setCoverVersionByAlbumId] = useState<Record<string, number>>({});
  const [seenAlbumIds, setSeenAlbumIds] = useState<ReadonlySet<string>>(() => new Set());
  const [albumsExpanded, setAlbumsExpanded] = useState(false);
  const [flipBusy, setFlipBusy] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const pendingFlipRef = useRef<FlipRects | null>(null);
  const pendingScrollRef = useRef<ScrollTopSnapshot | null>(null);
  const isMobile = useMediaQuery(media.mobile);
  // Свёртка ряда альбомов — только на мобилке; на tablet/desktop всегда развёрнуто.
  const showExpandedAlbums = !isMobile || albumsExpanded;

  const bumpAlbumCover = useCallback((albumId: string) => {
    setCoverVersionByAlbumId(prev => ({
      ...prev,
      [albumId]: (prev[albumId] ?? 0) + 1,
    }));
  }, []);

  const loadAlbums = useCallback(async () => {
    setLoading(true);
    setAccessDenied(false);
    try {
      const list = await getEventAlbums(eventId);
      setAlbums(list);
      setSeenAlbumIds(new Set());
    } catch (e: unknown) {
      if (isAccessDeniedError(e)) setAccessDenied(true);
      else setAlbums([]);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { void loadAlbums(); }, [loadAlbums]);

  const rememberSeen = useCallback((albumId: string) => {
    setSeenAlbumIds(prev => {
      if (prev.has(albumId)) return prev;
      const next = new Set(prev);
      next.add(albumId);
      return next;
    });
  }, []);

  const openAlbum = (album: IAlbum) => {
    setGridAlbum(album);
    void markAlbumViewed(album.id).then(() => {
      rememberSeen(album.id);
      syncUnseenAlbums();
    }).catch(() => {});
  };

  const displayAlbums = useMemo(
    () => presentAlbumsFreshFirst(albums, seenAlbumIds, gridAlbum?.id ?? null),
    [albums, seenAlbumIds, gridAlbum],
  );

  useLayoutEffect(() => {
    if (!compact) return;

    const scrollSnap = pendingScrollRef.current;
    if (scrollSnap) {
      pendingScrollRef.current = null;
      // Заморозка scrollTop у .page — секция растёт вниз, без уезда вверх.
      restoreScrollTop(scrollSnap);
    }

    const first = pendingFlipRef.current;
    const root = gridRef.current;
    if (!first || !root) return;
    pendingFlipRef.current = null;
    setFlipBusy(true);
    const order = displayAlbums.map(a => a.id);
    void playFlipScatter(root, first, order).finally(() => setFlipBusy(false));
  }, [compact, showExpandedAlbums, displayAlbums]);

  const captureLayoutAnchors = useCallback(() => {
    const root = gridRef.current;
    pendingScrollRef.current = captureScrollTop(sectionRef.current);
    if (root && !prefersReducedMotion()) {
      pendingFlipRef.current = captureFlipRects(root);
    }
  }, []);

  const expandAlbums = useCallback(() => {
    if (flipBusy || albumsExpanded) return;
    captureLayoutAnchors();
    setAlbumsExpanded(true);
  }, [flipBusy, albumsExpanded, captureLayoutAnchors]);

  const collapseAlbums = useCallback(() => {
    if (flipBusy || !albumsExpanded) return;
    captureLayoutAnchors();
    setAlbumsExpanded(false);
  }, [flipBusy, albumsExpanded, captureLayoutAnchors]);

  const toggleAlbumsExpanded = useCallback(() => {
    if (albumsExpanded) collapseAlbums();
    else expandAlbums();
  }, [albumsExpanded, collapseAlbums, expandAlbums]);

  const handleAlbumSaved = async (album: IAlbum) => {
    // Assign для новых альбомов делает AlbumFormModal (до привязки файлов).
    // Здесь — только если модалка создала альбом без eventId (legacy / другие экраны).
    const isNew = !albums.some(a => a.id === album.id);
    if (isNew && !album.eventId) {
      try { await assignAlbumToEvent(eventId, album.id); } catch { /* ignore */ }
    }
    setAlbums(prev => {
      const idx = prev.findIndex(a => a.id === album.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = album;
        return next;
      }
      return [...prev, album];
    });
    void loadAlbums();
  };

  const closeDeleteDialog = () => {
    setDeleteTarget(null);
    setDeleteStage('confirm');
  };

  const performDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAlbum(deleteTarget.id);
      setAlbums(prev => prev.filter(a => a.id !== deleteTarget.id));
      closeDeleteDialog();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setCheckingPhotos(true);
    let hasPhotos = false;
    try {
      const files = await getAlbumFiles(deleteTarget.id, 0, 1);
      hasPhotos = files.length > 0;
    } catch { /* если проверку не удалось выполнить — удаляем напрямую */ }
    finally { setCheckingPhotos(false); }

    if (hasPhotos) {
      setDeleteStage('photos');
    } else {
      await performDelete();
    }
  };

  const renderGrid = (items: IAlbum[], useCompactGrid = false) => (
    <div className={useCompactGrid ? styles.gridCompact : styles.grid}>
      {items.map(a => (
        <AlbumCard
          key={a.id}
          album={a}
          canManage={canManageAlbum(a, { isOrganizer: canManage })}
          coverVersion={coverVersionByAlbumId[a.id] ?? 0}
          onOpen={() => openAlbum(a)}
          onEdit={() => setFormAlbum(a)}
          onDelete={() => setDeleteTarget(a)}
        />
      ))}
      {canManage && <AddAlbumCard onClick={() => setFormAlbum(null)} />}
    </div>
  );

  const handleCloseGrid = useCallback(() => setGridAlbum(null), []);

  const modals = (
    <>
      <AlbumGridModal
        key={gridAlbum?.id ?? 'closed'}
        open={gridAlbum !== null}
        album={gridAlbum}
        canManage={gridAlbum ? canManageAlbum(gridAlbum, { isOrganizer: canManage }) : false}
        isParticipating={isParticipating}
        onClose={handleCloseGrid}
        onChanged={bumpAlbumCover}
      />
      {formAlbum !== undefined && (
        <AlbumFormModal
          album={formAlbum}
          accountId={accountId}
          eventId={eventId}
          existingAlbums={albums}
          onClose={() => setFormAlbum(undefined)}
          onSaved={handleAlbumSaved}
        />
      )}
      {deleteTarget && deleteStage === 'confirm' && (
        <DeleteAlbumDialog
          title="Удалить альбом?"
          text={`Альбом «${deleteTarget.name}» будет удалён без возможности восстановления.`}
          confirmLabel={checkingPhotos ? 'Проверка...' : 'Удалить'}
          loading={checkingPhotos || deleting}
          onConfirm={() => void handleConfirmDelete()}
          onClose={() => { if (!checkingPhotos && !deleting) closeDeleteDialog(); }}
        />
      )}
      {deleteTarget && deleteStage === 'photos' && (
        <DeleteAlbumDialog
          title="В альбоме есть фотографии"
          text="Фотографии, находящиеся в альбоме будут удалены безвозвратно. Всё равно удалить?"
          confirmLabel={deleting ? 'Удаление...' : 'Всё равно удалить'}
          loading={deleting}
          onConfirm={() => void performDelete()}
          onClose={() => { if (!deleting) closeDeleteDialog(); }}
        />
      )}
    </>
  );

  if (loading) {
    return (
      <div className={compact ? styles.albumsSection : styles.wrap}>
        <div className={styles.loading}>
          {[0, 1, 2].map(i => <div key={i} className={styles.skeleton} />)}
        </div>
        {modals}
      </div>
    );
  }

  if (accessDenied) {
    const deniedInner = (
      <div className={styles.loading}>
        {[0, 1].map(i => <div key={i} className={styles.skeleton} />)}
      </div>
    );
    const header = (
      <div className={styles.header}>
        {compact ? <div className={styles.title}>Фотоальбомы</div> : <h3 className={styles.title}>Фотоальбомы</h3>}
      </div>
    );
    return (
      <div className={compact ? styles.albumsSection : styles.wrap}>
        {header}
        <AccessDeniedGate denied variant="section">{deniedInner}</AccessDeniedGate>
      </div>
    );
  }

  if (!albums.length && !canManage) return null;

  if (compact) {
    const hasAlbums = albums.length > 0;
    // Организатор видит 3 обложки и кнопку «добавить». Остальные — 4 обложки.
    const collapsedLimit = canManage ? 3 : 4;
    const showOverflow = hasAlbums && !showExpandedAlbums && albums.length > collapsedLimit;
    const collapsedHead = showOverflow
      ? displayAlbums.slice(0, collapsedLimit - 1)
      : displayAlbums.slice(0, collapsedLimit);
    const overflowAlbums = showOverflow ? displayAlbums.slice(collapsedLimit - 1) : [];
    const hiddenAlbumCount = showOverflow
      ? Math.max(0, albums.length - collapsedLimit)
      : 0;
    const overflowCover = overflowAlbums[0];
    const gridClass = [
      showExpandedAlbums || (!hasAlbums && canManage) ? styles.gridCompact : styles.gridCollapsed,
      flipBusy ? styles.gridFlip : '',
    ].filter(Boolean).join(' ');

    let tiles: ReactNode = null;
    if (showExpandedAlbums || (!hasAlbums && canManage)) {
      tiles = (
        <>
          {displayAlbums.map(a => (
            <AlbumCard
              key={a.id}
              album={a}
              canManage={canManageAlbum(a, { isOrganizer: canManage })}
              coverVersion={coverVersionByAlbumId[a.id] ?? 0}
              flipId={a.id}
              onOpen={() => openAlbum(a)}
              onEdit={() => setFormAlbum(a)}
              onDelete={() => setDeleteTarget(a)}
            />
          ))}
          {canManage && <AddAlbumCard onClick={() => setFormAlbum(null)} />}
        </>
      );
    } else if (hasAlbums) {
      tiles = (
        <>
          {collapsedHead.map(a => (
            <AlbumCard
              key={a.id}
              album={a}
              canManage={canManageAlbum(a, { isOrganizer: canManage })}
              hideMeta
              flipId={a.id}
              coverVersion={coverVersionByAlbumId[a.id] ?? 0}
              onOpen={expandAlbums}
              onEdit={() => setFormAlbum(a)}
              onDelete={() => setDeleteTarget(a)}
            />
          ))}
          {showOverflow && overflowCover && (
            <AlbumCard
              key={overflowCover.id}
              album={overflowCover}
              canManage={false}
              hideMeta
              fadeRight={!albumHasNewContent(overflowCover)}
              overflowCount={hiddenAlbumCount}
              flipId={FLIP_STACK_ID}
              coverVersion={coverVersionByAlbumId[overflowCover.id] ?? 0}
              onOpen={expandAlbums}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          )}
          {canManage && <AddAlbumThumb onClick={() => setFormAlbum(null)} />}
        </>
      );
    }

    return (
      <div ref={sectionRef} className={styles.albumsSection}>
        <div className={styles.header}>
          <div className={styles.title}>Фотоальбомы</div>
          {hasAlbums && isMobile && (
            <button
              type="button"
              className={`${styles.count}${hiddenAlbumCount > 0 && !showExpandedAlbums ? ` ${styles.countOverflow}` : ''}`}
              aria-expanded={showExpandedAlbums}
              aria-label={`Альбомы: ${albums.length}`}
              disabled={flipBusy}
              onClick={toggleAlbumsExpanded}
            >
              {albums.length}
              {(showExpandedAlbums || hiddenAlbumCount === 0) && (
                <svg
                  className={`${styles.countChevron} ${showExpandedAlbums ? styles.countChevronOpen : ''}`}
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              )}
            </button>
          )}
          {hasAlbums && !isMobile && (
            <span className={styles.count}>{albums.length}</span>
          )}
        </div>
        {(hasAlbums || canManage) && (
          <div ref={gridRef} className={gridClass}>
            {tiles}
          </div>
        )}
        {modals}
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h3 className={styles.title}>Фотоальбомы</h3>
        {albums.length > 0 && <span className={styles.count}>{albums.length}</span>}
      </div>
      {renderGrid(displayAlbums)}
      {modals}
    </div>
  );
}
