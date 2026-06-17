// features/media/AlbumGridModal.tsx — сетка фотографий альбома

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getAlbumFiles,
  type IAlbum,
  type IAlbumFile,
} from '@/entities/media/albumApi';
import { uploadPhotosToAlbum } from '@/entities/media/albumFileApi';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { AlbumPhotoLightbox } from './AlbumPhotoLightbox';
import { AlbumPhotoUploadZone } from './AlbumPhotoUploadZone';
import styles from './AlbumGridModal.module.css';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

function GridThumbnail({
  fileId,
  alt,
  onClick,
}: {
  fileId: string;
  alt: string;
  onClick: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useLayoutEffect(() => {
    setLoaded(false);
    setError(false);
  }, [fileId]);

  return (
    <button type="button" className={styles.gridItem} onClick={onClick} aria-label={alt}>
      {!loaded && !error && <div className={styles.gridSpinner} aria-hidden />}
      {error ? (
        <div className={styles.gridError} aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>
          </svg>
        </div>
      ) : (
        <AuthImage
          fileId={fileId}
          fullSize={false}
          alt={alt}
          className={`${styles.gridImg} ${loaded ? styles.gridImgLoaded : styles.gridImgHidden}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      )}
    </button>
  );
}

interface AlbumGridModalProps {
  open: boolean;
  album: IAlbum | null;
  canManage?: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

export function AlbumGridModal({ open, album, canManage = false, onClose, onChanged }: AlbumGridModalProps) {
  const [files, setFiles] = useState<IAlbumFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useModalBackButton(onClose, open);

  const loadFiles = useCallback(async () => {
    if (!album) return;
    setLoading(true);
    try {
      const list = await getAlbumFiles(album.id, 1, 200);
      setFiles(list);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [album?.id]);

  useEffect(() => {
    if (!open || !album) return;
    void loadFiles();
  }, [open, album, loadFiles]);

  const appendOptimistic = (fileId: string) => {
    if (!album) return;
    setFiles(prev => {
      if (prev.some(f => f.fileId === fileId)) return prev;
      return [...prev, { id: `local-${fileId}`, fileId, albumId: album.id }];
    });
    onChanged?.();
  };

  if (!open || !album) return null;

  const uploadFiles = async (list: FileList | File[]) => {
    const items = Array.from(list).filter(f => f.type.startsWith('image/'));
    if (!items.length) return;

    setUploading(true);
    setUploadError(null);
    try {
      const ids = await uploadPhotosToAlbum(album.id, items);
      ids.forEach(appendOptimistic);
      void loadFiles();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const fileIds = files.map(f => f.fileId);

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-labelledby="album-grid-title">
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 id="album-grid-title" className={styles.title}>{album.name}</h2>
            {album.description && <p className={styles.desc}>{album.description}</p>}
          </div>
          <div className={styles.headerActions}>
            {canManage && (
              <button
                type="button"
                className={styles.uploadBtn}
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? 'Загрузка…' : 'Загрузить фото'}
              </button>
            )}
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {uploadError && <div className={styles.uploadError}>{uploadError}</div>}

          {loading ? (
            <div className={styles.loadingGrid}>
              {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className={styles.skeleton} />)}
            </div>
          ) : files.length === 0 ? (
            <div className={styles.empty}>
              {canManage ? (
                <AlbumPhotoUploadZone
                  mode="immediate"
                  albumId={album.id}
                  onUploaded={fileId => {
                    appendOptimistic(fileId);
                    void loadFiles();
                  }}
                />
              ) : (
                <p>В альбоме пока нет фотографий</p>
              )}
            </div>
          ) : (
            <div className={styles.grid}>
              {files.map((f, i) => (
                <GridThumbnail
                  key={f.id}
                  fileId={f.fileId}
                  alt={`Фото ${i + 1}`}
                  onClick={() => setLightboxIdx(i)}
                />
              ))}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className={styles.hiddenInput}
          onChange={e => {
            if (e.target.files?.length) void uploadFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {lightboxIdx !== null && fileIds.length > 0 && (
        <AlbumPhotoLightbox
          fileIds={fileIds}
          initialIdx={lightboxIdx}
          title={album.name}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>,
    document.body,
  );
}
