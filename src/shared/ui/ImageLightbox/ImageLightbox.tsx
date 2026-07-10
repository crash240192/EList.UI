// shared/ui/ImageLightbox/ImageLightbox.tsx
// Единый полноэкранный просмотр изображений с листанием и опциональным удалением

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AuthImage, prefetchAuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { HeroContextMenu, HeroContextMenuItem } from '@/shared/ui/HeroContextMenu';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import styles from './ImageLightbox.module.css';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';

export interface ImageLightboxProps {
  fileIds: string[];
  startIndex?: number;
  alt: string;
  onClose: () => void;
  zIndexBase?: number;
  canDelete?: boolean;
  deleteTitle?: string;
  deleteMessage?: string;
  onDelete?: (fileId: string) => Promise<void>;
  onDeleted?: (fileId: string) => void | Promise<void>;
  /** После удаления: новый индекс и число оставшихся фото (для синхронизации с родителем) */
  onAfterDelete?: (info: { currentIndex: number; remainingCount: number }) => void;
  fallback?: ReactNode;
}

type SlideDir = 1 | -1;

function nextIndexAfterDelete(currentIdx: number, nextLength: number): number {
  if (nextLength <= 0) return 0;
  return currentIdx < nextLength ? currentIdx : nextLength - 1;
}

function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 002 2h3M16 21v-3a2 2 0 012-2h3" />
    </svg>
  );
}

export function ImageLightbox({
  fileIds,
  startIndex = 0,
  alt,
  onClose,
  zIndexBase = 600,
  canDelete = false,
  deleteTitle = 'Удалить это фото?',
  deleteMessage,
  onDelete,
  onDeleted,
  onAfterDelete,
  fallback,
}: ImageLightboxProps) {
  const [ids, setIds] = useState(fileIds);
  const [idx, setIdx] = useState(startIndex);
  const [fullscreen, setFullscreen] = useState(false);
  const [slideDir, setSlideDir] = useState<SlideDir | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const idxRef = useRef(startIndex);
  const swipeStartX = useRef(0);
  idxRef.current = idx;

  const handleClose = useCallback(() => {
    if (fullscreen) {
      setFullscreen(false);
      return;
    }
    onClose();
  }, [fullscreen, onClose]);

  useModalBackButton(deleteConfirm ? () => setDeleteConfirm(false) : handleClose);

  const goTo = useCallback((newIdx: number) => {
    const current = idxRef.current;
    if (newIdx === current || newIdx < 0 || newIdx >= ids.length) return;
    setSlideDir(newIdx > current ? 1 : -1);
    setIdx(newIdx);
  }, [ids.length]);

  const prev = useCallback(() => goTo(idx - 1), [goTo, idx]);
  const next = useCallback(() => goTo(idx + 1), [goTo, idx]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (deleteConfirm || menuOpen) return;
      if (e.key === 'Escape') {
        handleClose();
        return;
      }
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [handleClose, prev, next, deleteConfirm, menuOpen]);

  useEffect(() => {
    if (!slideDir) return;
    const timer = window.setTimeout(() => setSlideDir(null), 320);
    return () => window.clearTimeout(timer);
  }, [idx, slideDir]);

  useEffect(() => {
    const neighbors = [ids[idx - 1], ids[idx + 1]].filter((id): id is string => !!id);
    neighbors.forEach(id => prefetchAuthImage(id, true));
  }, [ids, idx]);

  const handleDeleteConfirm = async () => {
    const fileId = ids[idx];
    if (!fileId || deleting || !onDelete) return;

    setDeleting(true);
    try {
      await onDelete(fileId);
      const nextIds = ids.filter((_, i) => i !== idx);

      if (nextIds.length === 0) {
        await onDeleted?.(fileId);
        onAfterDelete?.({ currentIndex: -1, remainingCount: 0 });
        setDeleteConfirm(false);
        setMenuOpen(false);
        onClose();
        return;
      }

      const newIdx = nextIndexAfterDelete(idx, nextIds.length);
      setIds(nextIds);
      setIdx(newIdx);
      setSlideDir(null);
      await onDeleted?.(fileId);
      onAfterDelete?.({ currentIndex: newIdx, remainingCount: nextIds.length });
      setDeleteConfirm(false);
      setMenuOpen(false);
    } catch {
      // ошибка API покажется через глобальный обработчик
    } finally {
      setDeleting(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) next();
    else prev();
  };

  if (!ids.length) return null;

  const currentFileId = ids[idx];
  const showDelete = canDelete && !!onDelete;
  const confirmZIndex = zIndexBase + 50;
  const slideClass = slideDir === 1
    ? styles.slideFromRight
    : slideDir === -1
      ? styles.slideFromLeft
      : '';

  const content = (
    <>
      <div
        className={`${styles.backdrop} ${fullscreen ? styles.backdropFs : ''}`}
        style={{ zIndex: zIndexBase }}
        onClick={e => {
          if (e.target === e.currentTarget) handleClose();
        }}
      />
      <div
        className={`${styles.lightbox} ${fullscreen ? styles.lightboxFs : ''}`}
        style={{ zIndex: zIndexBase + 1 }}
      >
        <div className={styles.topBar}>
          {ids.length > 1 && (
            <div className={styles.counter}>{idx + 1} / {ids.length}</div>
          )}

          <div className={styles.topActions}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setFullscreen(f => !f)}
              aria-label={fullscreen ? 'Свернуть' : 'На весь экран'}
            >
              {fullscreen ? <CollapseIcon /> : <ExpandIcon />}
            </button>
            {showDelete && (
              <>
                <button
                  ref={menuBtnRef}
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => setMenuOpen(v => !v)}
                  aria-label="Меню"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
                  </svg>
                </button>
                <HeroContextMenu
                  open={menuOpen}
                  onClose={() => setMenuOpen(false)}
                  anchorRef={menuBtnRef}
                  zIndexBase={zIndexBase + 10}
                  aria-label="Действия с фото"
                >
                  <HeroContextMenuItem
                    danger
                    onClick={() => {
                      setMenuOpen(false);
                      setDeleteConfirm(true);
                    }}
                  >
                    Удалить
                  </HeroContextMenuItem>
                </HeroContextMenu>
              </>
            )}
            <button type="button" className={styles.iconBtn} onClick={handleClose} aria-label="Закрыть">
              ✕
            </button>
          </div>
        </div>

        <div
          className={styles.imageArea}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className={styles.slideArea}>
            {currentFileId && (
              <div key={currentFileId} className={`${styles.slide} ${slideClass}`}>
                <AuthImage
                  fileId={currentFileId}
                  fullSize
                  alt={alt}
                  className={styles.image}
                  imageFit="contain"
                  preloaderDelayMs={300}
                  fallback={fallback ?? <div className={styles.fallback} aria-hidden />}
                />
              </div>
            )}
          </div>

          {idx > 0 && (
            <button type="button" className={`${styles.arrow} ${styles.arrowLeft}`} onClick={prev} aria-label="Предыдущее фото">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          )}
          {idx < ids.length - 1 && (
            <button type="button" className={`${styles.arrow} ${styles.arrowRight}`} onClick={next} aria-label="Следующее фото">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          )}
        </div>

        {!fullscreen && ids.length > 1 && ids.length <= 10 && (
          <div className={styles.dots}>
            {ids.map((id, i) => (
              <button
                key={id}
                type="button"
                className={`${styles.dot} ${i === idx ? styles.dotActive : ''}`}
                onClick={() => goTo(i)}
                aria-label={`Фото ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {deleteConfirm && (
        <ConfirmDialog
          title={deleteTitle}
          message={deleteMessage}
          confirmLabel="Удалить"
          cancelLabel="Отмена"
          zIndex={confirmZIndex}
          onConfirm={() => void handleDeleteConfirm()}
          onCancel={() => setDeleteConfirm(false)}
        />
      )}
    </>
  );

  return createPortal(content, document.body);
}
