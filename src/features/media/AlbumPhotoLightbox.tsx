// features/media/AlbumPhotoLightbox.tsx — просмотр одного фото на весь экран

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import styles from './AlbumPhotoLightbox.module.css';

type SlideDir = 1 | -1;

interface AlbumPhotoLightboxProps {
  fileIds: string[];
  initialIdx: number;
  title?: string;
  onClose: () => void;
}

export function AlbumPhotoLightbox({ fileIds, initialIdx, title, onClose }: AlbumPhotoLightboxProps) {
  const [idx, setIdx] = useState(initialIdx);
  const [fullscreen, setFullscreen] = useState(false);
  const [slideDir, setSlideDir] = useState<SlideDir | null>(null);
  const swipeStartX = useRef(0);
  const idxRef = useRef(initialIdx);
  idxRef.current = idx;

  const goTo = useCallback((newIdx: number) => {
    const current = idxRef.current;
    if (newIdx === current || newIdx < 0 || newIdx >= fileIds.length) return;
    setSlideDir(newIdx > current ? 1 : -1);
    setIdx(newIdx);
  }, [fileIds.length]);

  const prev = useCallback(() => goTo(idx - 1), [goTo, idx]);
  const next = useCallback(() => goTo(idx + 1), [goTo, idx]);

  const handleClose = useCallback(() => {
    if (fullscreen) {
      setFullscreen(false);
      return;
    }
    onClose();
  }, [fullscreen, onClose]);

  useModalBackButton(handleClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [prev, next, handleClose]);

  useEffect(() => {
    if (!slideDir) return;
    const timer = window.setTimeout(() => setSlideDir(null), 320);
    return () => window.clearTimeout(timer);
  }, [idx, slideDir]);

  const handleTouchStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) next();
    else prev();
  };

  const fileId = fileIds[idx];
  const slideClass = slideDir === 1
    ? styles.slideFromRight
    : slideDir === -1
      ? styles.slideFromLeft
      : '';

  return createPortal(
    <div
      className={`${styles.backdrop} ${fullscreen ? styles.backdropFs : ''}`}
      onClick={e => {
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          handleClose();
        }
      }}
    >
      <div className={`${styles.viewer} ${fullscreen ? styles.viewerFs : ''}`}>
        <div className={styles.header}>
          <div>
            {title && <div className={styles.title}>{title}</div>}
            <div className={styles.count}>{idx + 1} / {fileIds.length}</div>
          </div>
          <div className={styles.headerBtns}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setFullscreen(f => !f)}
              aria-label={fullscreen ? 'Свернуть' : 'На весь экран'}
            >
              {fullscreen
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 002 2h3M16 21v-3a2 2 0 012-2h3"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3"/></svg>}
            </button>
            <button type="button" className={styles.iconBtn} onClick={handleClose} aria-label="Закрыть">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div
          className={styles.main}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className={styles.slideArea}>
            {fileId && (
              <div key={fileId} className={`${styles.slide} ${slideClass}`}>
                <AuthImage
                  fileId={fileId}
                  fullSize
                  alt={`Фото ${idx + 1}`}
                  className={styles.img}
                  imageFit="contain"
                />
              </div>
            )}
          </div>

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
