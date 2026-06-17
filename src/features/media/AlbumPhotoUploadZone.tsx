// features/media/AlbumPhotoUploadZone.tsx — зона drag-and-drop для фото альбома

import { useRef, useState } from 'react';
import { uploadPhotoToAlbum, uploadPhotosToAlbum } from '@/entities/media/albumFileApi';
import styles from './AlbumPhotoUploadZone.module.css';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

interface AlbumPhotoUploadZoneProps {
  /** immediate — загрузка сразу (нужен albumId); deferred — файлы в очередь до сохранения альбома */
  mode: 'immediate' | 'deferred';
  albumId?: string | null;
  disabled?: boolean;
  compact?: boolean;
  onUploaded?: (fileId: string) => void;
  onFilesQueued?: (files: File[]) => void;
  /** Если задан — immediate-режим отдаёт файлы родителю (свои прелоадеры) */
  onFilesSelected?: (files: File[]) => void;
  /** Количество файлов в очереди (режим deferred) */
  pendingCount?: number;
}

export function AlbumPhotoUploadZone({
  mode,
  albumId,
  disabled = false,
  compact = false,
  onUploaded,
  onFilesQueued,
  onFilesSelected,
  pendingCount = 0,
}: AlbumPhotoUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDisabled = disabled || uploading || (mode === 'immediate' && !albumId);

  const validateFiles = (list: FileList | File[]): File[] => {
    const files = Array.from(list);
    const valid: File[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError('Можно загружать только изображения');
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError('Файл слишком большой (макс. 10 МБ)');
        continue;
      }
      valid.push(file);
    }
    return valid;
  };

  const handleFiles = async (list: FileList | File[]) => {
    const files = validateFiles(list);
    if (!files.length || isDisabled) return;

    setError(null);

    if (mode === 'deferred') {
      onFilesQueued?.(files);
      return;
    }

    if (!albumId) return;

    if (onFilesSelected) {
      onFilesSelected(files);
      return;
    }

    setUploading(true);
    try {
      const ids = files.length === 1
        ? [await uploadPhotoToAlbum(albumId, files[0])]
        : await uploadPhotosToAlbum(albumId, files);
      ids.forEach(id => onUploaded?.(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const hint = mode === 'deferred'
    ? 'Фото загрузятся после создания альбома'
    : 'JPG, PNG, WEBP · до 10 МБ';

  return (
    <div className={styles.wrap}>
      <div
        className={`${styles.zone} ${compact ? styles.zoneCompact : ''} ${dragging ? styles.dragging : ''} ${isDisabled ? styles.disabled : ''}`}
        onClick={() => !isDisabled && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); if (!isDisabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          if (!isDisabled && e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        onKeyDown={e => {
          if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        {uploading ? (
          <span className={styles.spinner} aria-label="Загрузка" />
        ) : (
          <>
            <svg width={compact ? 22 : 28} height={compact ? 22 : 28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18M9 3v6M15 3v6"/>
              <circle cx="12" cy="15" r="2"/>
            </svg>
            <span className={styles.hint}>
              {compact ? 'Перетащите фото или нажмите' : 'Нажмите или перетащите фотографии'}
            </span>
            <span className={styles.sub}>{hint}</span>
            {pendingCount > 0 && (
              <span className={styles.queued}>В очереди: {pendingCount}</span>
            )}
          </>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className={styles.hiddenInput}
        onChange={e => {
          if (e.target.files?.length) void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
