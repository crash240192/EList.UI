// features/media/AlbumGridModal.tsx — сетка фотографий альбома

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getAlbumFiles,
  type IAlbum,
  type IAlbumFile,
} from '@/entities/media/albumApi';
import { uploadPhotoToAlbum } from '@/entities/media/albumFileApi';
import { filterImageFiles } from '@/shared/lib/imageFile';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { AlbumPhotoLightbox } from './AlbumPhotoLightbox';
import { AlbumPhotoUploadZone } from './AlbumPhotoUploadZone';
import styles from './AlbumGridModal.module.css';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

function mergeAlbumFiles(prev: IAlbumFile[], server: IAlbumFile[]): IAlbumFile[] {
  const serverFileIds = new Set(server.map(f => f.fileId));
  const locals = prev.filter(f => !serverFileIds.has(f.fileId));
  return [...server, ...locals];
}

function nextUploadId(): string {
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface UploadingItem {
  localId: string;
  previewUrl: string;
  error?: string;
}

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

function GridUploadingTile({ item }: { item: UploadingItem }) {
  return (
    <div
      className={`${styles.gridItem} ${styles.gridItemUploading}`}
      aria-busy={!item.error}
      aria-label={item.error ? 'Ошибка загрузки' : 'Загрузка фото'}
    >
      <img src={item.previewUrl} alt="" className={styles.gridUploadPreview} />
      {item.error ? (
        <div className={styles.gridUploadError} title={item.error}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
      ) : (
        <div className={styles.gridUploadOverlay}>
          <div className={styles.gridSpinner} aria-hidden />
        </div>
      )}
    </div>
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
  const [uploadingItems, setUploadingItems] = useState<UploadingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef<UploadingItem[]>([]);

  useModalBackButton(onClose, open);

  const revokeUploadingPreviews = useCallback((items: UploadingItem[]) => {
    items.forEach(item => URL.revokeObjectURL(item.previewUrl));
  }, []);

  const loadFiles = useCallback(async (opts?: { silent?: boolean }) => {
    if (!album) return;
    if (!opts?.silent) setLoading(true);
    try {
      const list = await getAlbumFiles(album.id, 1, 200);
      setFiles(prev => mergeAlbumFiles(prev, list));
    } catch {
      if (!opts?.silent) setFiles([]);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [album?.id]);

  useEffect(() => {
    if (!open || !album) return;
    setUploadError(null);
    void loadFiles();
  }, [open, album?.id, loadFiles]);

  useEffect(() => {
    uploadingRef.current = uploadingItems;
  }, [uploadingItems]);

  useEffect(() => {
    if (open) return;
    revokeUploadingPreviews(uploadingRef.current);
    setUploadingItems([]);
    setUploadError(null);
  }, [open, revokeUploadingPreviews]);

  useEffect(() => () => revokeUploadingPreviews(uploadingRef.current), [revokeUploadingPreviews]);

  const appendFile = useCallback((fileId: string) => {
    if (!album) return;
    setFiles(prev => {
      if (prev.some(f => f.fileId === fileId)) return prev;
      return [...prev, { id: `local-${fileId}`, fileId, albumId: album.id }];
    });
    onChanged?.();
  }, [album, onChanged]);

  const removeUploadingItem = useCallback((localId: string) => {
    setUploadingItems(prev => {
      const item = prev.find(u => u.localId === localId);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter(u => u.localId !== localId);
    });
  }, []);

  const startUpload = useCallback(async (list: FileList | File[]) => {
    if (!album) return;
    const items = filterImageFiles(list);
    if (!items.length) {
      setUploadError('Можно загружать только изображения');
      return;
    }

    setUploadError(null);

    const placeholders: Array<UploadingItem & { file: File }> = items.map(file => ({
      localId: nextUploadId(),
      previewUrl: URL.createObjectURL(file),
      file,
    }));

    setUploadingItems(prev => [
      ...prev,
      ...placeholders.map(({ localId, previewUrl }) => ({ localId, previewUrl })),
    ]);

    let hadError = false;

    try {
      await Promise.all(placeholders.map(async ({ localId, file }) => {
        try {
          const fileId = await uploadPhotoToAlbum(album.id, file);
          removeUploadingItem(localId);
          appendFile(fileId);
        } catch (e) {
          hadError = true;
          const message = e instanceof Error ? e.message : 'Ошибка загрузки';
          setUploadingItems(prev => prev.map(u => (
            u.localId === localId ? { ...u, error: message } : u
          )));
        }
      }));
    } catch (e) {
      hadError = true;
      setUploadError(e instanceof Error ? e.message : 'Ошибка загрузки');
    }

    if (hadError) {
      setUploadError(prev => prev ?? 'Не удалось загрузить часть фотографий');
    }

    void loadFiles({ silent: true });
  }, [album, appendFile, loadFiles, removeUploadingItem]);

  if (!open || !album) return null;

  const hasGridContent = files.length > 0 || uploadingItems.length > 0;
  const uploadingCount = uploadingItems.filter(u => !u.error).length;
  const showSkeleton = loading && uploadingItems.length === 0;
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
                disabled={uploadingCount > 0}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingCount > 0 ? `Загрузка… (${uploadingCount})` : 'Загрузить фото'}
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

          {showSkeleton ? (
            <div className={styles.loadingGrid}>
              {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className={styles.skeleton} />)}
            </div>
          ) : !hasGridContent ? (
            <div className={styles.empty}>
              {canManage ? (
                <AlbumPhotoUploadZone
                  mode="immediate"
                  albumId={album.id}
                  onFilesSelected={files => void startUpload(files)}
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
              {uploadingItems.map(item => (
                <GridUploadingTile key={item.localId} item={item} />
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
            if (e.target.files?.length) void startUpload(e.target.files);
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
