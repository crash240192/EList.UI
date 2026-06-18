// features/media/AlbumPhotoPreviewGrid.tsx — сетка превью при добавлении фото

import styles from './AlbumPhotoPreviewGrid.module.css';

export interface PhotoPreviewItem {
  localId: string;
  previewUrl: string;
  uploading?: boolean;
  error?: string;
}

interface AlbumPhotoPreviewGridProps {
  items: PhotoPreviewItem[];
}

export function AlbumPhotoPreviewGrid({ items }: AlbumPhotoPreviewGridProps) {
  if (!items.length) return null;

  return (
    <div className={styles.grid} aria-label="Выбранные фотографии">
      {items.map(item => (
        <div
          key={item.localId}
          className={`${styles.tile} ${item.uploading ? styles.tileUploading : ''}`}
          aria-busy={item.uploading}
          aria-label={item.error ? 'Ошибка загрузки' : item.uploading ? 'Загрузка фото' : 'Фото в очереди'}
        >
          <img src={item.previewUrl} alt="" className={styles.preview} />
          {item.error ? (
            <div className={styles.errorOverlay} title={item.error}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
          ) : item.uploading ? (
            <div className={styles.uploadOverlay}>
              <div className={styles.spinner} aria-hidden />
            </div>
          ) : (
            <div className={styles.queuedBadge}>В очереди</div>
          )}
        </div>
      ))}
    </div>
  );
}
