// shared/ui/AvatarLightbox/AvatarLightbox.tsx
// Полноэкранный просмотр аватара с листанием истории

import { useState, useEffect, useCallback, useRef } from 'react';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { HeroContextMenu, HeroContextMenuItem } from '@/shared/ui/HeroContextMenu';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { deleteAvatar } from '@/entities/user/avatarApi';
import styles from './AvatarLightbox.module.css';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';

interface AvatarLightboxProps {
  fileIds:   string[];   // история: [0] = самый свежий
  startIndex?: number;
  initials:  string;
  onClose:   () => void;
  canDelete?: boolean;
  onDeleted?: (fileId: string) => void | Promise<void>;
}

export function AvatarLightbox({
  fileIds,
  startIndex = 0,
  initials,
  onClose,
  canDelete = false,
  onDeleted,
}: AvatarLightboxProps) {
  const [ids, setIds] = useState(fileIds);
  const [idx, setIdx] = useState(startIndex);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  useModalBackButton(deleteConfirm ? () => setDeleteConfirm(false) : onClose);

  useEffect(() => {
    setIds(fileIds);
    setIdx(startIndex);
  }, [fileIds, startIndex]);

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
    if (!fileId || deleting) return;

    setDeleting(true);
    try {
      await deleteAvatar(fileId);
      const nextIds = ids.filter((_, i) => i !== idx);
      setIds(nextIds);
      await onDeleted?.(fileId);
      setDeleteConfirm(false);
      setMenuOpen(false);

      if (nextIds.length === 0) {
        onClose();
        return;
      }

      setIdx(i => Math.min(i, nextIds.length - 1));
    } catch {
      // ошибка API покажется через глобальный обработчик
    } finally {
      setDeleting(false);
    }
  };

  if (!ids.length) return null;

  const currentFileId = ids[idx];

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.lightbox}>
        <div className={styles.topBar}>
          {ids.length > 1 && (
            <div className={styles.counter}>{idx + 1} / {ids.length}</div>
          )}

          <div className={styles.topActions}>
            {canDelete && (
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
                  zIndexBase={610}
                  aria-label="Действия с аватаром"
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
            alt={initials}
            className={styles.image}
            fallback={
              <div className={styles.fallbackAvatar}>
                <span>{initials}</span>
              </div>
            }
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
          title="Удалить это фото?"
          message="Аватар будет удалён из истории профиля."
          confirmLabel="Удалить"
          cancelLabel="Отмена"
          onConfirm={() => void handleDeleteConfirm()}
          onCancel={() => setDeleteConfirm(false)}
        />
      )}
    </>
  );
}
