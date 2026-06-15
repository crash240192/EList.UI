// pages/event/EventAlbums.tsx
// Блок альбомов на странице мероприятия

import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  getEventAlbums,
  getAlbumFiles,
  assignAlbumToEvent,
  deleteAlbum,
  type IAlbum,
  type IAlbumFile,
} from '@/entities/media/albumApi';
import { AlbumFormModal } from '@/features/media/AlbumFormModal';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { AccessDeniedGate } from '@/shared/ui/AccessDenied/AccessDeniedGate';
import { isAccessDeniedError } from '@/shared/api/apiErrorUtils';
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

// ── Модалка просмотра альбома ─────────────────────────────────────────────────
interface AlbumViewerProps {
  album: IAlbum;
  files: IAlbumFile[];
  initialIdx: number;
  onClose: () => void;
}

function AlbumViewer({ album, files, initialIdx, onClose }: AlbumViewerProps) {
  const [idx, setIdx] = useState(initialIdx);
  const [fullscreen, setFullscreen] = useState(false);

  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIdx(i => Math.min(files.length - 1, i + 1)), [files.length]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     { fullscreen ? setFullscreen(false) : onClose(); }
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [prev, next, onClose, fullscreen]);

  const swipeStart = { x: 0 };
  const handleTouchStart = (e: React.TouchEvent) => { swipeStart.x = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - swipeStart.x;
    if (Math.abs(dx) > 50) { dx < 0 ? next() : prev(); }
  };

  const cur = files[idx];

  return createPortal(
    <div className={`${styles.viewerBackdrop} ${fullscreen ? styles.viewerFs : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.viewer}>
        <div className={styles.viewerHeader}>
          <div>
            <div className={styles.viewerTitle}>{album.name}</div>
            <div className={styles.viewerCount}>{idx + 1} / {files.length}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className={styles.viewerBtn} onClick={() => setFullscreen(f => !f)} title={fullscreen ? 'Свернуть' : 'На весь экран'}>
              {fullscreen
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 002 2h3M16 21v-3a2 2 0 012-2h3"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3"/></svg>}
            </button>
            <button type="button" className={styles.viewerBtn} onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div className={styles.viewerMain} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {cur && <SpinnerImage fileId={cur.fileId} alt={`Фото ${idx + 1}`} className={styles.viewerImg} fullSize />}
          {idx > 0 && (
            <button type="button" className={`${styles.arrow} ${styles.arrowLeft}`} onClick={prev}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}
          {idx < files.length - 1 && (
            <button type="button" className={`${styles.arrow} ${styles.arrowRight}`} onClick={next}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}
        </div>

        {files.length > 1 && (
          <div className={styles.viewerStrip}>
            {files.map((f, i) => (
              <div key={f.id} className={`${styles.thumb} ${i === idx ? styles.thumbActive : ''}`}
                onClick={() => setIdx(i)}>
                <SpinnerImage fileId={f.fileId} alt="" className={styles.thumbImg} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Диалог подтверждения удаления ─────────────────────────────────────────────
function DeleteAlbumDialog({ albumName, loading, onConfirm, onClose }: {
  albumName: string; loading: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return createPortal(
    <>
      <div className={styles.dialogBackdrop} onClick={onClose} />
      <div className={styles.dialog} role="dialog" aria-modal>
        <div className={styles.dialogTitle}>Удалить альбом?</div>
        <div className={styles.dialogText}>
          Альбом «{albumName}» будет удалён без возможности восстановления.
        </div>
        <div className={styles.dialogBtns}>
          <button type="button" className={styles.dialogCancel} onClick={onClose} disabled={loading}>Отмена</button>
          <button type="button" className={styles.dialogDelete} onClick={onConfirm} disabled={loading}>
            {loading ? 'Удаление...' : 'Удалить'}
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
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function AlbumCard({ album, canManage, onOpen, onEdit, onDelete }: AlbumCardProps) {
  const [cover, setCover] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getAlbumFiles(album.id, 1, 1).then(files => {
      if (!cancelled && files.length > 0) setCover(files[0].fileId);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [album.id]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <div className={styles.albumCard}>
      <div className={styles.albumCardBody} onClick={onOpen} role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}>
        <div className={styles.albumCover}>
          {cover
            ? <SpinnerImage fileId={cover} alt={album.name} className={styles.albumCoverImg} />
            : <div className={styles.albumCoverEmpty}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>
                  <circle cx="9" cy="15" r="2"/><path d="M14 13l3 4"/>
                </svg>
              </div>
          }
          {album.parameters?.private && (
            <div className={styles.privateBadge}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            </div>
          )}
        </div>
        <div className={styles.albumMeta}>
          <div className={styles.albumName}>{album.name}</div>
          {album.description && <div className={styles.albumDesc}>{album.description}</div>}
        </div>
      </div>

      {canManage && (
        <div className={styles.albumMenuWrap} ref={menuRef}>
          <button
            type="button"
            className={styles.albumMenuBtn}
            aria-label="Меню альбома"
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
            </svg>
          </button>
          {menuOpen && (
            <div className={styles.albumMenu}>
              <button type="button" className={styles.albumMenuItem} onClick={e => { e.stopPropagation(); setMenuOpen(false); onEdit(); }}>
                Редактировать
              </button>
              <button type="button" className={`${styles.albumMenuItem} ${styles.albumMenuItemDanger}`}
                onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}>
                Удалить
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddAlbumCard({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={styles.addAlbumCard} onClick={onClick}>
      <div className={styles.albumCover}>
        <div className={styles.addAlbumIcon}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </div>
      </div>
      <div className={styles.albumMeta}>
        <div className={styles.albumName}>Добавить альбом</div>
      </div>
    </button>
  );
}

// ── Основной блок ──────────────────────────────────────────────────────────────
interface EventAlbumsProps {
  eventId: string;
  compact?: boolean;
  canManage?: boolean;
  accountId?: string | null;
}

export function EventAlbums({ eventId, compact, canManage = false, accountId = null }: EventAlbumsProps) {
  const [albums,  setAlbums]  = useState<IAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [viewer,  setViewer]  = useState<{ album: IAlbum; files: IAlbumFile[]; idx: number } | null>(null);
  const [formAlbum, setFormAlbum] = useState<IAlbum | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<IAlbum | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAlbums = useCallback(async () => {
    setLoading(true);
    setAccessDenied(false);
    try {
      const list = await getEventAlbums(eventId);
      setAlbums(list);
    } catch (e: unknown) {
      if (isAccessDeniedError(e)) setAccessDenied(true);
      else setAlbums([]);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { void loadAlbums(); }, [loadAlbums]);

  const openAlbum = async (album: IAlbum) => {
    const files = await getAlbumFiles(album.id, 1, 100);
    setViewer({ album, files, idx: 0 });
  };

  const handleAlbumSaved = async (album: IAlbum) => {
    const isNew = !albums.some(a => a.id === album.id);
    if (isNew) {
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAlbum(deleteTarget.id);
      setAlbums(prev => prev.filter(a => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  const renderGrid = (items: IAlbum[], gridStyle?: React.CSSProperties) => (
    <div className={styles.grid} style={gridStyle}>
      {items.map(a => (
        <AlbumCard
          key={a.id}
          album={a}
          canManage={canManage}
          onOpen={() => void openAlbum(a)}
          onEdit={() => setFormAlbum(a)}
          onDelete={() => setDeleteTarget(a)}
        />
      ))}
      {canManage && <AddAlbumCard onClick={() => setFormAlbum(null)} />}
    </div>
  );

  const modals = (
    <>
      {viewer && (
        <AlbumViewer
          album={viewer.album}
          files={viewer.files}
          initialIdx={viewer.idx}
          onClose={() => setViewer(null)}
        />
      )}
      {formAlbum !== undefined && (
        <AlbumFormModal
          album={formAlbum}
          accountId={accountId}
          onClose={() => setFormAlbum(undefined)}
          onSaved={handleAlbumSaved}
        />
      )}
      {deleteTarget && (
        <DeleteAlbumDialog
          albumName={deleteTarget.name}
          loading={deleting}
          onConfirm={() => void handleDelete()}
          onClose={() => !deleting && setDeleteTarget(null)}
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
    return (
      <div className={styles.albumsSection}>
        <div className={styles.header}>
          <div className={styles.title}>Фотоальбомы</div>
          {albums.length > 0 && <span className={styles.count}>{albums.length}</span>}
        </div>
        {renderGrid(albums.slice(0, canManage ? albums.length : 4), { gridTemplateColumns: '1fr 1fr' })}
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
      {renderGrid(albums)}
      {modals}
    </div>
  );
}
