// features/media/AlbumFormModal.tsx

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  assignAlbumToEvent,
  createAlbum,
  deleteAlbum,
  updateAlbum,
  type IAlbum,
  type ICreateAlbumPayload,
} from '@/entities/media/albumApi';
import { linkFilesToAlbum } from '@/entities/media/albumFileApi';
import { uploadFile } from '@/shared/api/fileStorageClient';
import { filterImageFiles } from '@/shared/lib/imageFile';
import { AlbumPhotoUploadZone } from './AlbumPhotoUploadZone';
import { AlbumPhotoPreviewGrid, type PhotoPreviewItem } from './AlbumPhotoPreviewGrid';
import styles from './AlbumFormModal.module.css';

interface AlbumFormModalProps {
  onClose: () => void;
  onSaved: (album: IAlbum) => void;
  accountId: string | null;
  organizationId?: string | null;
  /** Если задан — после create сразу assign, затем загрузка фото (нужно для RO-альбомов). */
  eventId?: string | null;
  /** Альбомы этой карточки мероприятия — проверка названия до загрузки фото. */
  existingAlbums?: IAlbum[];
  album?: IAlbum | null;
}

interface PendingPhoto {
  localId: string;
  previewUrl: string;
  file: File;
}

function nextLocalId(): string {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Chrome: «Failed to fetch». Firefox и Safari пишут то же обрывом сети другими словами. */
function isFetchFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('load failed');
}

const PHOTO_FETCH_FAILURE_TEXT = 'При создании альбома возникла ошибка. Вероятно, данная ошибка появилась на этапе загрузки фотографий';
const NAME_TAKEN_TEXT = 'Альбом с таким названием уже есть';

function sameAlbumName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('ru-RU') === b.trim().toLocaleLowerCase('ru-RU');
}

export function AlbumFormModal({
  onClose,
  onSaved,
  accountId,
  organizationId,
  eventId = null,
  existingAlbums = [],
  album,
}: AlbumFormModalProps) {
  const isEdit = !!album;

  const [name,        setName]        = useState(album?.name ?? '');
  const [description, setDescription] = useState(album?.description ?? '');
  const [headAlbum,   setHeadAlbum]   = useState(album?.parameters?.headAlbum ?? false);
  const [readOnly,    setReadOnly]    = useState(album?.parameters?.participantsReadonly ?? false);
  const [isPrivate,   setIsPrivate]   = useState(album?.parameters?.private ?? false);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [uploadingPhotoIds, setUploadingPhotoIds] = useState<Set<string>>(() => new Set());
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [photoFetchFailed, setPhotoFetchFailed] = useState(false);
  const [nameTaken, setNameTaken] = useState(false);
  const pendingRef = useRef<PendingPhoto[]>([]);

  const revokePendingPreviews = useCallback((items: PendingPhoto[]) => {
    items.forEach(item => URL.revokeObjectURL(item.previewUrl));
  }, []);

  useEffect(() => {
    pendingRef.current = pendingPhotos;
  }, [pendingPhotos]);

  useEffect(() => () => revokePendingPreviews(pendingRef.current), [revokePendingPreviews]);

  const queuePhotos = useCallback((files: File[]) => {
    const images = filterImageFiles(files);
    if (!images.length) return;
    setPendingPhotos(prev => [
      ...prev,
      ...images.map(file => ({
        localId: nextLocalId(),
        previewUrl: URL.createObjectURL(file),
        file,
      })),
    ]);
  }, []);

  const previewItems: PhotoPreviewItem[] = pendingPhotos.map(item => ({
    localId: item.localId,
    previewUrl: item.previewUrl,
    uploading: uploadingPhotoIds.has(item.localId),
  }));

  const uploadingPhotos = uploadingPhotoIds.size > 0;

  const handleSave = async () => {
    if (!name.trim()) {
      setNameTaken(false);
      setError('Укажите название альбома');
      return;
    }
    if (!isEdit && existingAlbums.some(item => sameAlbumName(item.name, name))) {
      setError(null);
      setNameTaken(true);
      return;
    }
    setNameTaken(false);
    setSaving(true);
    setError(null);
    try {
      const parameters = { headAlbum, participantsReadonly: readOnly, private: isPrivate };
      if (isEdit && album) {
        await updateAlbum({
          id: album.id,
          name: name.trim(),
          description: description.trim() || undefined,
          parameters,
        });
        onSaved({
          ...album,
          name: name.trim(),
          description: description.trim() || undefined,
          parameters,
        });
      } else {
        const payload: ICreateAlbumPayload = {
          name: name.trim(),
          description: description.trim() || undefined,
          accountId: accountId ?? undefined,
          organizationId: organizationId ?? undefined,
          parameters,
        };
        // Фото уходят в хранилище до создания альбома: обрыв сети не должен оставлять пустой альбом.
        let uploadedIds: string[] = [];
        if (pendingPhotos.length > 0) {
          setUploadingPhotoIds(new Set(pendingPhotos.map(p => p.localId)));
          uploadedIds = await Promise.all(pendingPhotos.map(async photo => {
            try {
              const uploaded = await uploadFile(photo.file);
              return uploaded.id;
            } finally {
              setUploadingPhotoIds(prev => {
                const next = new Set(prev);
                next.delete(photo.localId);
                return next;
              });
            }
          }));
        }
        const newId = await createAlbum(payload);
        try {
          // Сначала привязка к событию: ParticipantsReadonly иначе блокирует AddFiles
          // на ещё личном альбоме (флаг про участников мероприятия, не владельца).
          if (eventId) {
            await assignAlbumToEvent(eventId, newId);
          }
          if (uploadedIds.length > 0) {
            await linkFilesToAlbum(newId, uploadedIds);
          }
        } catch (e: unknown) {
          if (isFetchFailure(e)) {
            try { await deleteAlbum(newId); } catch { /* альбом не должен остаться */ }
          }
          throw e;
        }
        revokePendingPreviews(pendingPhotos);
        setPendingPhotos([]);
        onSaved({
          id: newId,
          name: name.trim(),
          description: description.trim() || undefined,
          eventId: eventId ?? undefined,
          parameters,
        });
      }
      onClose();
    } catch (e: unknown) {
      if (!isEdit && pendingPhotos.length > 0 && isFetchFailure(e)) {
        setPhotoFetchFailed(true);
        return;
      }
      setError(e instanceof Error ? e.message : 'Ошибка при сохранении альбома');
    } finally {
      setSaving(false);
      setUploadingPhotoIds(new Set());
    }
  };

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal
        aria-labelledby={photoFetchFailed ? undefined : 'album-form-title'}
        aria-label={photoFetchFailed ? PHOTO_FETCH_FAILURE_TEXT : undefined}
      >
        {!photoFetchFailed && <div className={styles.modalHeader}>
          <span id="album-form-title" className={styles.modalTitle}>
            {isEdit ? 'Редактировать альбом' : 'Новый альбом'}
          </span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>}

        {photoFetchFailed ? (
          <div className={styles.fetchFailure}>
            <p className={styles.fetchFailureText}>{PHOTO_FETCH_FAILURE_TEXT}</p>
            <button type="button" className={styles.fetchFailureClose} onClick={onClose}>
              Закрыть
            </button>
          </div>
        ) : (
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label className={styles.label}>Название *</label>
            <input
              className={`${styles.input} ${nameTaken ? styles.inputInvalid : ''}`}
              value={name}
              onChange={e => {
                setName(e.target.value);
                setNameTaken(false);
              }}
              placeholder="Например: Фото с выступления"
              aria-invalid={nameTaken || undefined}
              aria-describedby={nameTaken ? 'album-name-taken' : undefined}
              onFocus={e => e.target.select()}
              autoFocus
            />
            {nameTaken && (
              <div id="album-name-taken" className={styles.nameTakenHint}>{NAME_TAKEN_TEXT}</div>
            )}
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Описание</label>
            <textarea className={styles.textarea} value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Краткое описание альбома..."
              rows={2} />
          </div>

          <div className={styles.flags}>
            <label className={styles.flagRow}>
              <input type="checkbox" checked={headAlbum} onChange={e => setHeadAlbum(e.target.checked)} />
              <div>
                <div className={styles.flagLabel}>Главный альбом</div>
                <div className={styles.flagHint}>Отображается первым на странице мероприятия</div>
              </div>
            </label>
            <label className={styles.flagRow}>
              <input type="checkbox" checked={readOnly} onChange={e => setReadOnly(e.target.checked)} />
              <div>
                <div className={styles.flagLabel}>Только просмотр для участников</div>
                <div className={styles.flagHint}>
                  Участники не смогут добавлять фото (организатор по-прежнему может)
                </div>
              </div>
            </label>
            <label className={styles.flagRow}>
              <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} />
              <div>
                <div className={styles.flagLabel}>Приватный альбом</div>
                <div className={styles.flagHint}>Доступен только участникам мероприятия</div>
              </div>
            </label>
          </div>

          <div className={styles.photosSection}>
            {isEdit && album ? (
              <AlbumPhotoUploadZone
                mode="immediate"
                albumId={album.id}
                disabled={saving}
                compact
              />
            ) : (
              <>
                <AlbumPhotoUploadZone
                  mode="deferred"
                  disabled={saving || uploadingPhotos}
                  compact
                  onFilesQueued={queuePhotos}
                />
                <AlbumPhotoPreviewGrid items={previewItems} />
              </>
            )}
          </div>

          {error && <div className={styles.error}>{error}</div>}
        </div>
        )}

        {!photoFetchFailed && <div className={styles.modalFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={saving}>Отмена</button>
          <button type="button" className={styles.saveBtn} onClick={() => void handleSave()} disabled={saving || uploadingPhotos || !name.trim()}>
            {saving ? (uploadingPhotos ? 'Загрузка фото…' : 'Сохранение...') : isEdit ? 'Сохранить' : 'Создать альбом'}
          </button>
        </div>}
      </div>
    </>,
    document.body,
  );
}
