// pages/event/EventAlbums.tsx
// Блок альбомов на странице мероприятия

import { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { getEventAlbums, getAlbumFiles, type IAlbum, type IAlbumFile } from '@/entities/media/albumApi';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
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

  // Клавиши
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     { fullscreen ? setFullscreen(false) : onClose(); }
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [prev, next, onClose, fullscreen]);

  // Свайп
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
        {/* Хедер */}
        <div className={styles.viewerHeader}>
          <div>
            <div className={styles.viewerTitle}>{album.name}</div>
            <div className={styles.viewerCount}>{idx + 1} / {files.length}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={styles.viewerBtn} onClick={() => setFullscreen(f => !f)} title={fullscreen ? 'Свернуть' : 'На весь экран'}>
              {fullscreen
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3"/></svg>}
            </button>
            <button className={styles.viewerBtn} onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Главное фото */}
        <div className={styles.viewerMain}
          onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {cur && <SpinnerImage fileId={cur.fileId} alt={`Фото ${idx + 1}`} className={styles.viewerImg} fullSize />}
          {idx > 0 && (
            <button className={`${styles.arrow} ${styles.arrowLeft}`} onClick={prev}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}
          {idx < files.length - 1 && (
            <button className={`${styles.arrow} ${styles.arrowRight}`} onClick={next}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}
        </div>

        {/* Полоса миниатюр */}
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
    document.body
  );
}

// ── Карточка альбома ──────────────────────────────────────────────────────────
function AlbumCard({ album, onClick }: { album: IAlbum; onClick: () => void }) {
  const [cover, setCover] = useState<string | null>(null);
  const [loadingCover, setLoadingCover] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAlbumFiles(album.id, 1, 1).then(files => {
      if (!cancelled && files.length > 0) setCover(files[0].fileId);
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoadingCover(false);
    });
    return () => { cancelled = true; };
  }, [album.id]);

  return (
    <div className={styles.albumCard} onClick={onClick}>
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
  );
}

// ── Основной блок ──────────────────────────────────────────────────────────────
interface EventAlbumsProps { eventId: string; compact?: boolean; }

export function EventAlbums({ eventId, compact }: EventAlbumsProps) {
  const [albums,  setAlbums]  = useState<IAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewer,  setViewer]  = useState<{ album: IAlbum; files: IAlbumFile[]; idx: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    getEventAlbums(eventId)
      .then(a => { if (!cancelled) setAlbums(a); })
      .catch(() => {}) // если API недоступен — просто скрываем блок
      .finally(() => { clearTimeout(timer); if (!cancelled) setLoading(false); });

    return () => { cancelled = true; controller.abort(); };
  }, [eventId]);

  const openAlbum = async (album: IAlbum, startIdx = 0) => {
    const files = await getAlbumFiles(album.id, 1, 100);
    setViewer({ album, files, idx: startIdx });
  };

  if (loading) return (
    <div className={styles.loading}>
      {[0,1,2].map(i => <div key={i} className={styles.skeleton} />)}
    </div>
  );
  if (!albums.length) return null;

  if (compact) {
    return (
      <div className={styles.albumsSection}>
        <div className={styles.header}>
          <div className={styles.title}>Фотоальбомы</div>
          <span className={styles.count}>{albums.length}</span>
        </div>
        <div className={styles.grid} style={{ gridTemplateColumns: '1fr 1fr' }}>
          {albums.slice(0, 4).map(a => (
            <AlbumCard key={a.id} album={a} onClick={() => openAlbum(a)} />
          ))}
        </div>
        {viewer && <AlbumViewer album={viewer.album} files={viewer.files} initialIdx={viewer.idx} onClose={() => setViewer(null)} />}
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h3 className={styles.title}>Фотоальбомы</h3>
        <span className={styles.count}>{albums.length}</span>
      </div>
      <div className={styles.grid}>
        {albums.map(a => (
          <AlbumCard key={a.id} album={a} onClick={() => openAlbum(a)} />
        ))}
      </div>
      {viewer && (
        <AlbumViewer
          album={viewer.album}
          files={viewer.files}
          initialIdx={viewer.idx}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}
