// features/media/AlbumGridModal.tsx — сетка фотографий альбома

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getAlbumFiles,
  type IAlbum,
  type IAlbumFile,
} from '@/entities/media/albumApi';
import { uploadPhotoToAlbum, deleteAlbumFile, deleteAlbumFiles } from '@/entities/media/albumFileApi';
import { canAddPhotosToAlbum } from '@/entities/media/albumPermissions';
import { filterImageFiles } from '@/shared/lib/imageFile';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { ImageLightbox } from '@/shared/ui/ImageLightbox';
import { AlbumPhotoUploadZone } from './AlbumPhotoUploadZone';
import styles from './AlbumGridModal.module.css';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

function nextUploadId(): string {
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toAlbumFile(albumId: string, fileId: string): IAlbumFile {
  return { id: `local-${fileId}`, fileId, albumId };
}

function appendUniqueFiles(prev: IAlbumFile[], albumId: string, fileIds: string[]): IAlbumFile[] {
  if (!fileIds.length) return prev;
  const existing = new Set(prev.map(f => f.fileId));
  const added = fileIds
    .filter(id => !existing.has(id))
    .map(id => toAlbumFile(albumId, id));
  return added.length ? [...prev, ...added] : prev;
}

interface UploadingItem {
  localId: string;
  previewUrl: string;
  error?: string;
}

function GridThumbnail({
  fileId,
  alt,
  selected = false,
  selectMode = false,
  onClick,
}: {
  fileId: string;
  alt: string;
  selected?: boolean;
  selectMode?: boolean;
  onClick: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useLayoutEffect(() => {
    setLoaded(false);
    setError(false);
  }, [fileId]);

  return (
    <button
      type="button"
      className={`${styles.gridItem} ${selected ? styles.gridItemSelected : ''} ${selectMode ? styles.gridItemSelectMode : ''}`}
      onClick={onClick}
      aria-label={alt}
      aria-pressed={selectMode ? selected : undefined}
    >
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
      {selectMode && (
        <span className={`${styles.gridCheck} ${selected ? styles.gridCheckOn : ''}`} aria-hidden>
          {selected && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
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
  isParticipating?: boolean;
  onClose: () => void;
  onChanged?: (albumId: string) => void;
}

export function AlbumGridModal({
  open,
  album,
  canManage = false,
  isParticipating = false,
  onClose,
  onChanged,
}: AlbumGridModalProps) {
  const [files, setFiles] = useState<IAlbumFile[]>([]);
  const [uploadingItems, setUploadingItems] = useState<UploadingItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef<UploadingItem[]>([]);
  const dirtyRef = useRef(false);
  const loadedForAlbumIdRef = useRef<string | null>(null);
  const uploadChainRef = useRef(Promise.resolve());

  const revokeUploadingPreviews = useCallback((items: UploadingItem[]) => {
    items.forEach(item => URL.revokeObjectURL(item.previewUrl));
  }, []);

  const handleClose = useCallback(() => {
    setLightboxIdx(null);
    setSelectMode(false);
    setSelectedIds(new Set());
    setDeleteConfirm(false);
    if (dirtyRef.current && album) {
      onChanged?.(album.id);
      dirtyRef.current = false;
    }
    onClose();
  }, [album, onChanged, onClose]);

  useModalBackButton(handleClose, open);

  useEffect(() => {
    if (!open || !album) {
      if (!open) loadedForAlbumIdRef.current = null;
      return;
    }

    if (loadedForAlbumIdRef.current === album.id) return;

    let cancelled = false;
    loadedForAlbumIdRef.current = album.id;
    setInitialLoading(true);
    setUploadError(null);

    void (async () => {
      try {
        const list = await getAlbumFiles(album.id, 1, 200);
        if (!cancelled) setFiles(list);
      } catch {
        if (!cancelled) setFiles([]);
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, album?.id]);

  useEffect(() => {
    uploadingRef.current = uploadingItems;
  }, [uploadingItems]);

  useEffect(() => {
    if (open) return;
    setLightboxIdx(null);
    setSelectMode(false);
    setSelectedIds(new Set());
    setDeleteConfirm(false);
    uploadChainRef.current = Promise.resolve();
    revokeUploadingPreviews(uploadingRef.current);
    setUploadingItems([]);
    setUploadError(null);
    dirtyRef.current = false;
  }, [open, revokeUploadingPreviews]);

  useEffect(() => () => revokeUploadingPreviews(uploadingRef.current), [revokeUploadingPreviews]);

  const clearUploadingPlaceholders = useCallback((localIds: string[]) => {
    if (!localIds.length) return;
    const remove = new Set(localIds);
    setUploadingItems(prev => {
      const next = prev.filter(item => {
        if (remove.has(item.localId)) {
          URL.revokeObjectURL(item.previewUrl);
          return false;
        }
        return true;
      });
      return next;
    });
  }, []);

  const startUpload = useCallback((list: FileList | File[]) => {
    if (!album) return;
    if (!canAddPhotosToAlbum(album, { isOrganizer: canManage, isParticipating })) return;
    const items = filterImageFiles(list);
    if (!items.length) {
      setUploadError('Можно загружать только изображения');
      return;
    }

    uploadChainRef.current = uploadChainRef.current.then(async () => {
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

      for (const placeholder of placeholders) {
        try {
          const id = await uploadPhotoToAlbum(album.id, placeholder.file);
          clearUploadingPlaceholders([placeholder.localId]);
          setFiles(prev => appendUniqueFiles(prev, album.id, [id]));
          dirtyRef.current = true;
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Ошибка загрузки';
          setUploadError(message);
          setUploadingItems(prev => prev.map(item => (
            item.localId === placeholder.localId && !item.error
              ? { ...item, error: message }
              : item
          )));
        }
      }
    }).catch(() => {});
  }, [album, canManage, isParticipating, clearUploadingPlaceholders]);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleFileSelection = useCallback((fileId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (!album || selectedIds.size === 0 || bulkDeleting) return;
    setBulkDeleting(true);
    try {
      const ids = [...selectedIds];
      await deleteAlbumFiles(album.id, ids);
      setFiles(prev => prev.filter(f => !selectedIds.has(f.fileId)));
      dirtyRef.current = true;
      exitSelectMode();
      setDeleteConfirm(false);
    } catch {
      // ошибка API покажется через глобальный обработчик
    } finally {
      setBulkDeleting(false);
    }
  }, [album, selectedIds, bulkDeleting, exitSelectMode]);

  if (!open || !album) return null;

  const canUploadPhotos = canAddPhotosToAlbum(album, {
    isOrganizer: canManage,
    isParticipating,
  });

  const hasGridContent = files.length > 0 || uploadingItems.length > 0;
  const uploadingCount = uploadingItems.filter(u => !u.error).length;
  const showSkeleton = initialLoading && uploadingItems.length === 0 && files.length === 0;
  const fileIds = files.map(f => f.fileId);
  const selectedCount = selectedIds.size;
  const canSelectPhotos = canManage && files.length > 0;

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={handleClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-labelledby="album-grid-title">
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 id="album-grid-title" className={styles.title}>{album.name}</h2>
            {album.description && <p className={styles.desc}>{album.description}</p>}
          </div>
          <div className={styles.headerActions}>
            {selectMode && selectedCount > 0 && (
              <button
                type="button"
                className={styles.deleteBtn}
                disabled={bulkDeleting}
                onClick={() => setDeleteConfirm(true)}
              >
                {bulkDeleting ? 'Удаление…' : `Удалить (${selectedCount})`}
              </button>
            )}
            {canSelectPhotos && (
              <button
                type="button"
                className={selectMode ? styles.selectModeBtnActive : styles.selectModeBtn}
                onClick={() => {
                  if (selectMode) exitSelectMode();
                  else setSelectMode(true);
                }}
              >
                {selectMode ? 'Отмена' : 'Выбрать'}
              </button>
            )}
            {canUploadPhotos && !selectMode && (
              <button
                type="button"
                className={styles.uploadBtn}
                disabled={uploadingCount > 0}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingCount > 0 ? `Загрузка… (${uploadingCount})` : 'Загрузить фото'}
              </button>
            )}
            <button type="button" className={styles.closeBtn} onClick={handleClose} aria-label="Закрыть">
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
              {canUploadPhotos ? (
                <AlbumPhotoUploadZone
                  mode="immediate"
                  albumId={album.id}
                  disabled={uploadingCount > 0}
                  onFilesSelected={files => startUpload(files)}
                />
              ) : (
                <p>В альбоме пока нет фотографий</p>
              )}
            </div>
          ) : (
            <div className={styles.grid}>
              {files.map((f, i) => (
                <GridThumbnail
                  key={f.fileId}
                  fileId={f.fileId}
                  alt={`Фото ${i + 1}`}
                  selectMode={selectMode}
                  selected={selectedIds.has(f.fileId)}
                  onClick={() => {
                    if (selectMode) toggleFileSelection(f.fileId);
                    else setLightboxIdx(i);
                  }}
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

      {lightboxIdx !== null && (
        <ImageLightbox
          fileIds={fileIds}
          startIndex={lightboxIdx}
          alt={`Фото ${lightboxIdx + 1}`}
          onClose={() => setLightboxIdx(null)}
          zIndexBase={900}
          canDelete={canManage}
          onDelete={fileId => deleteAlbumFile(fileId, album.id)}
          deleteMessage="Фотография будет удалена из альбома без возможности восстановления."
          onDeleted={fileId => {
            setFiles(prev => prev.filter(f => f.fileId !== fileId));
            dirtyRef.current = true;
          }}
          onAfterDelete={({ currentIndex, remainingCount }) => {
            setLightboxIdx(remainingCount === 0 ? null : currentIndex);
          }}
        />
      )}

      {deleteConfirm && selectedCount > 0 && (
        <ConfirmDialog
          title={selectedCount === 1 ? 'Удалить фото?' : `Удалить ${selectedCount} фото?`}
          message="Фотографии будут удалены из альбома без возможности восстановления."
          confirmLabel="Удалить"
          cancelLabel="Отмена"
          zIndex={910}
          onConfirm={() => void handleBulkDelete()}
          onCancel={() => setDeleteConfirm(false)}
        />
      )}
    </>,
    document.body,
  );
}
