// shared/ui/ImageLightbox/ImageLightbox.tsx
// Единый полноэкранный просмотр изображений с листанием и опциональным удалением

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
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
  fallback?: ReactNode;
}

function nextIndexAfterDelete(currentIdx: number, nextLength: number): number {
  if (nextLength <= 0) return 0;
  return currentIdx < nextLength ? currentIdx : nextLength - 1;
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
  fallback,
}: ImageLightboxProps) {
  const [ids, setIds] = useState(fileIds);
  const [idx, setIdx] = useState(startIndex);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  useModalBackButton(deleteConfirm ? () => setDeleteConfirm(false) : onClose);

  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIdx(i => Math.min(ids.length - 1, i + 1)), [ids.length]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (deleteConfirm || menuOpen) return;
      if (e.key === 'Escape')     onClose();
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose, prev, next, deleteConfirm, menuOpen]);

  const handleDeleteConfirm = async () => {
    const fileId = ids[idx];
    if (!fileId || deleting || !onDelete) return;

    setDeleting(true);
    try {
      await onDelete(fileId);
      const nextIds = ids.filter((_, i) => i !== idx);

      if (nextIds.length === 0) {
        await onDeleted?.(fileId);
        setDeleteConfirm(false);
        setMenuOpen(false);
        onClose();
        return;
      }

      const newIdx = nextIndexAfterDelete(idx, nextIds.length);
      setIds(nextIds);
      setIdx(newIdx);
      await onDeleted?.(fileId);
      setDeleteConfirm(false);
      setMenuOpen(false);
    } catch {
      // ошибка API покажется через глобальный обработчик
    } finally {
      setDeleting(false);
    }
  };

  if (!ids.length) return null;

  const currentFileId = ids[idx];
  const showDelete = canDelete && !!onDelete;
  const confirmZIndex = zIndexBase + 50;

  const content = (
    <>
      <div
        className={styles.backdrop}
        style={{ zIndex: zIndexBase }}
        onClick={onClose}
      />
      <div className={styles.lightbox} style={{ zIndex: zIndexBase + 1 }}>
        <div className={styles.topBar}>
          {ids.length > 1 && (
            <div className={styles.counter}>{idx + 1} / {ids.length}</div>
          )}

          <div className={styles.topActions}>
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
            <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Закрыть">
              ✕
            </button>
          </div>
        </div>

        <div className={styles.imageWrap}>
          <AuthImage
            key={currentFileId}
            fileId={currentFileId}
            fullSize
            alt={alt}
            className={styles.image}
            fallback={fallback ?? <div className={styles.fallback} aria-hidden />}
          />
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

        {ids.length > 1 && ids.length <= 10 && (
          <div className={styles.dots}>
            {ids.map((id, i) => (
              <button
                key={id}
                type="button"
                className={`${styles.dot} ${i === idx ? styles.dotActive : ''}`}
                onClick={() => setIdx(i)}
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
