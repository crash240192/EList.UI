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
} from '@/entities/media/albumApi';
import { AlbumFormModal } from '@/features/media/AlbumFormModal';
import { AlbumGridModal } from '@/features/media/AlbumGridModal';
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
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function AlbumCard({ album, canManage, coverVersion = 0, onOpen, onEdit, onDelete }: AlbumCardProps) {
  const [cover, setCover] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getAlbumFiles(album.id, 1, 1).then(files => {
      if (!cancelled && files.length > 0) setCover(files[0].fileId);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [album.id, coverVersion]);

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
      <div className={`${styles.albumCover} ${styles.addAlbumCover}`}>
        <div className={styles.addAlbumIcon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
    } catch (e: unknown) {
      if (isAccessDeniedError(e)) setAccessDenied(true);
      else setAlbums([]);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { void loadAlbums(); }, [loadAlbums]);

  const openAlbum = (album: IAlbum) => {
    setGridAlbum(album);
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
      const files = await getAlbumFiles(deleteTarget.id, 1, 1);
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
          canManage={canManage}
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
        open={gridAlbum !== null}
        album={gridAlbum}
        canManage={canManage}
        isParticipating={isParticipating}
        onClose={handleCloseGrid}
        onChanged={bumpAlbumCover}
      />
      {formAlbum !== undefined && (
        <AlbumFormModal
          album={formAlbum}
          accountId={accountId}
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
    return (
      <div className={styles.albumsSection}>
        <div className={styles.header}>
          <div className={styles.title}>Фотоальбомы</div>
          {albums.length > 0 && <span className={styles.count}>{albums.length}</span>}
        </div>
        {renderGrid(albums.slice(0, canManage ? albums.length : 4), true)}
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
