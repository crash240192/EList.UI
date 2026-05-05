// shared/ui/AvatarLightbox/AvatarLightbox.tsx
// Полноэкранный просмотр аватара с листанием истории

import { useState, useEffect, useCallback } from 'react';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import styles from './AvatarLightbox.module.css';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';

interface AvatarLightboxProps {
  fileIds:   string[];   // история: [0] = самый свежий
  startIndex?: number;
  initials:  string;
  onClose:   () => void;
}

export function AvatarLightbox({ fileIds, startIndex = 0, initials, onClose }: AvatarLightboxProps) {
  useModalBackButton(onClose);
  const [idx, setIdx] = useState(startIndex);

  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIdx(i => Math.min(fileIds.length - 1, i + 1)), [fileIds.length]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     onClose();
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose, prev, next]);

  if (!fileIds.length) return null;

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.lightbox}>
        {/* Кнопка закрытия */}
        <button className={styles.closeBtn} onClick={onClose}>✕</button>

        {/* Счётчик */}
        {fileIds.length > 1 && (
          <div className={styles.counter}>{idx + 1} / {fileIds.length}</div>
        )}

        {/* Изображение */}
        <div className={styles.imageWrap}>
          <AuthImage
            fileId={fileIds[idx]}
            alt={initials}
            className={styles.image}
            fallback={
              <div className={styles.fallbackAvatar}>
                <span>{initials}</span>
              </div>
            }
          />
        </div>

        {/* Стрелки */}
        {idx > 0 && (
          <button className={`${styles.arrow} ${styles.arrowLeft}`} onClick={prev}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}
        {idx < fileIds.length - 1 && (
          <button className={`${styles.arrow} ${styles.arrowRight}`} onClick={next}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        )}

        {/* Точки-индикаторы */}
        {fileIds.length > 1 && fileIds.length <= 10 && (
          <div className={styles.dots}>
            {fileIds.map((_, i) => (
              <button
                key={i}
                className={`${styles.dot} ${i === idx ? styles.dotActive : ''}`}
                onClick={() => setIdx(i)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
