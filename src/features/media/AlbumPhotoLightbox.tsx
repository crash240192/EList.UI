// features/media/AlbumPhotoLightbox.tsx — просмотр одного фото на весь экран

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import styles from './AlbumPhotoLightbox.module.css';

interface AlbumPhotoLightboxProps {
  fileIds: string[];
  initialIdx: number;
  title?: string;
  onClose: () => void;
}

export function AlbumPhotoLightbox({ fileIds, initialIdx, title, onClose }: AlbumPhotoLightboxProps) {
  const [idx, setIdx] = useState(initialIdx);
  const [fullscreen, setFullscreen] = useState(false);

  useModalBackButton(onClose);

  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIdx(i => Math.min(fileIds.length - 1, i + 1)), [fileIds.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { fullscreen ? setFullscreen(false) : onClose(); }
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [prev, next, onClose, fullscreen]);

  const swipeStart = { x: 0 };
  const handleTouchStart = (e: React.TouchEvent) => { swipeStart.x = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - swipeStart.x;
    if (Math.abs(dx) > 50) { dx < 0 ? next() : prev(); }
  };

  const fileId = fileIds[idx];

  return createPortal(
    <div
      className={`${styles.backdrop} ${fullscreen ? styles.backdropFs : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.viewer}>
        <div className={styles.header}>
          <div>
            {title && <div className={styles.title}>{title}</div>}
            <div className={styles.count}>{idx + 1} / {fileIds.length}</div>
          </div>
          <div className={styles.headerBtns}>
            <button type="button" className={styles.iconBtn} onClick={() => setFullscreen(f => !f)} aria-label="На весь экран">
              {fullscreen
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 002 2h3M16 21v-3a2 2 0 012-2h3"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3"/></svg>}
            </button>
            <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Закрыть">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div className={styles.main} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {fileId && (
            <AuthImage fileId={fileId} fullSize alt={`Фото ${idx + 1}`} className={styles.img} imageFit="contain" />
          )}
          {idx > 0 && (
            <button type="button" className={`${styles.arrow} ${styles.arrowLeft}`} onClick={prev} aria-label="Предыдущее">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}
          {idx < fileIds.length - 1 && (
            <button type="button" className={`${styles.arrow} ${styles.arrowRight}`} onClick={next} aria-label="Следующее">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
