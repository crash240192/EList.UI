// features/media/AlbumFormModal.tsx

import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  createAlbum,
  updateAlbum,
  type IAlbum,
  type ICreateAlbumPayload,
} from '@/entities/media/albumApi';
import { uploadPhotosToAlbum } from '@/entities/media/albumFileApi';
import { AlbumPhotoUploadZone } from './AlbumPhotoUploadZone';
import styles from './AlbumFormModal.module.css';

interface AlbumFormModalProps {
  onClose: () => void;
  onSaved: (album: IAlbum) => void;
  accountId: string | null;
  organizationId?: string | null;
  album?: IAlbum | null;
}

export function AlbumFormModal({
  onClose,
  onSaved,
  accountId,
  organizationId,
  album,
}: AlbumFormModalProps) {
  const isEdit = !!album;

  const [name,        setName]        = useState(album?.name ?? '');
  const [description, setDescription] = useState(album?.description ?? '');
  const [headAlbum,   setHeadAlbum]   = useState(album?.parameters?.headAlbum ?? false);
  const [readOnly,    setReadOnly]    = useState(album?.parameters?.participantsReadonly ?? false);
  const [isPrivate,   setIsPrivate]   = useState(album?.parameters?.private ?? false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) { setError('Укажите название альбома'); return; }
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
        const newId = await createAlbum(payload);
        if (pendingFiles.length > 0) {
          await uploadPhotosToAlbum(newId, pendingFiles);
        }
        onSaved({
          id: newId,
          name: name.trim(),
          description: description.trim() || undefined,
          parameters,
        });
        setPendingFiles([]);
      }
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка при сохранении альбома');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-labelledby="album-form-title">
        <div className={styles.modalHeader}>
          <span id="album-form-title" className={styles.modalTitle}>
            {isEdit ? 'Редактировать альбом' : 'Новый альбом'}
          </span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label className={styles.label}>Название *</label>
            <input className={styles.input} value={name} onChange={e => setName(e.target.value)}
              placeholder="Например: Фото с выступления"
              onFocus={e => e.target.select()} autoFocus />
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
                <div className={styles.flagHint}>Участники не смогут добавлять фото</div>
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
              <AlbumPhotoUploadZone
                mode="deferred"
                disabled={saving}
                compact
                pendingCount={pendingFiles.length}
                onFilesQueued={files => setPendingFiles(prev => [...prev, ...files])}
              />
            )}
          </div>

          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={saving}>Отмена</button>
          <button type="button" className={styles.saveBtn} onClick={() => void handleSave()} disabled={saving || !name.trim()}>
            {saving ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать альбом'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
