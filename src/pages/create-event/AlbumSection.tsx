// pages/create-event/AlbumSection.tsx
// Управление фотоальбомами на странице создания/редактирования мероприятия

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { createAlbum, deleteAlbum, assignAlbumToEvent, type IAlbum, type ICreateAlbumPayload } from '@/entities/media/albumApi';
import styles from './AlbumSection.module.css';

interface AlbumSectionProps {
  albums: IAlbum[];
  onAlbumsChange: (albums: IAlbum[]) => void;
  accountId: string | null;
  organizationId?: string | null;
  /** Если передан — альбом привязывается к событию сразу после создания (режим редактирования) */
  eventId?: string | null;
}

// ── Модальное окно создания альбома ──────────────────────────────────────────
interface CreateAlbumModalProps {
  onClose: () => void;
  onCreate: (album: IAlbum) => void;
  accountId: string | null;
  organizationId?: string | null;
}

function CreateAlbumModal({ onClose, onCreate, accountId, organizationId }: CreateAlbumModalProps) {
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [headAlbum,   setHeadAlbum]   = useState(false);
  const [readOnly,    setReadOnly]     = useState(false);
  const [isPrivate,   setIsPrivate]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) { setError('Укажите название альбома'); return; }
    setSaving(true); setError(null);
    try {
      const payload: ICreateAlbumPayload = {
        name: name.trim(),
        description: description.trim() || undefined,
        accountId:      accountId      ?? undefined,
        organizationId: organizationId ?? undefined,
        parameters: { headAlbum, participantsReadonly: readOnly, private: isPrivate },
      };
      const newId = await createAlbum(payload);
      const newAlbum: IAlbum = { id: newId, name: name.trim(), description: description.trim() || undefined, parameters: payload.parameters };
      onCreate(newAlbum);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Ошибка при создании альбома');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Новый альбом</span>
          <button className={styles.closeBtn} onClick={onClose}>
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

          {/* Заглушка: фото будут добавляться позднее */}
          <div className={styles.photosPlaceholder}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18M9 3v6M15 3v6"/>
              <circle cx="12" cy="15" r="2"/>
            </svg>
            <span>Добавление фотографий будет доступно после публикации мероприятия</span>
          </div>

          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={saving}>Отмена</button>
          <button className={styles.saveBtn} onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? 'Создание...' : 'Создать альбом'}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Основной компонент ────────────────────────────────────────────────────────
export function AlbumSection({ albums, onAlbumsChange, accountId, organizationId, eventId }: AlbumSectionProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = async (album: IAlbum) => {
    // Если мероприятие уже существует (режим редактирования) — привязываем сразу
    if (eventId) {
      try { await assignAlbumToEvent(eventId, album.id); } catch { /* ignore */ }
    }
    onAlbumsChange([...albums, album]);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      // Если альбом ещё не привязан к событию — просто удаляем из локального стейта
      // (у нового мероприятия eventId ещё нет)
      const album = albums.find(a => a.id === id);
      if (album?.eventId) await deleteAlbum(id);
      onAlbumsChange(albums.filter(a => a.id !== id));
    } catch { /* ignore */ }
    setDeletingId(null);
  };

  return (
    <div className={styles.wrap}>
      {albums.length === 0 ? (
        <div className={styles.empty}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>
            <circle cx="9" cy="15" r="2"/><path d="M14 13l3 4"/>
          </svg>
          <span>Альбомы не добавлены</span>
        </div>
      ) : (
        <div className={styles.albumList}>
          {albums.map(album => (
            <div key={album.id} className={styles.albumCard}>
              <div className={styles.albumCover}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>
                  <circle cx="9" cy="15" r="2"/><path d="M14 13l3 4"/>
                </svg>
              </div>
              <div className={styles.albumInfo}>
                <div className={styles.albumName}>{album.name}</div>
                {album.description && <div className={styles.albumDesc}>{album.description}</div>}
                <div className={styles.albumTags}>
                  {album.parameters?.headAlbum       && <span className={styles.tag}>Главный</span>}
                  {album.parameters?.private          && <span className={styles.tag}>Приватный</span>}
                  {album.parameters?.participantsReadonly && <span className={styles.tag}>Только чтение</span>}
                </div>
              </div>
              <button className={styles.deleteBtn}
                onClick={() => handleDelete(album.id)}
                disabled={deletingId === album.id}
                title="Удалить альбом">
                {deletingId === album.id
                  ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>...</span>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                      <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                }
              </button>
            </div>
          ))}
        </div>
      )}

      <button className={styles.addBtn} onClick={() => setShowCreate(true)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Добавить альбом
      </button>

      {showCreate && (
        <CreateAlbumModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
          accountId={accountId}
          organizationId={organizationId}
        />
      )}
    </div>
  );
}
