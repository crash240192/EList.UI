// features/bug-reports/BugReportModal.tsx

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  createBugReport,
  fetchBugReportCategories,
  type IBugReportCategory,
} from '@/entities/bugReport';
import { uploadFile } from '@/shared/api/fileStorageClient';
import { Select } from '@/shared/ui/Select/Select';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import styles from './BugReportModal.module.css';

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

interface Shot {
  fileId: string;
  previewUrl: string;
}

interface BugReportModalProps {
  onClose: () => void;
}

export function BugReportModal({ onClose }: BugReportModalProps) {
  const [categories, setCategories] = useState<IBugReportCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [shots, setShots] = useState<Shot[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useModalBackButton(onClose);

  const loadCategories = useCallback(async () => {
    setLoadingCats(true);
    setError(null);
    try {
      const list = await fetchBugReportCategories(true);
      setCategories(list);
      if (list.length > 0) setCategoryId(list[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить разделы');
    } finally {
      setLoadingCats(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = MAX_FILES - shots.length;
    if (remaining <= 0) {
      setError(`Можно приложить не больше ${MAX_FILES} скриншотов`);
      return;
    }

    const batch = Array.from(files).slice(0, remaining);
    setUploading(true);
    setError(null);
    try {
      const uploaded: Shot[] = [];
      for (const file of batch) {
        if (!file.type.startsWith('image/')) {
          setError('Только изображения (jpg, png, webp)');
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          setError('Файл слишком большой (макс. 10 МБ)');
          continue;
        }
        const previewUrl = URL.createObjectURL(file);
        const result = await uploadFile(file);
        uploaded.push({ fileId: result.id, previewUrl });
      }
      if (uploaded.length) {
        setShots(prev => [...prev, ...uploaded].slice(0, MAX_FILES));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки файла');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeShot = (fileId: string) => {
    setShots(prev => {
      const next = prev.filter(s => s.fileId !== fileId);
      const removed = prev.find(s => s.fileId === fileId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const handleSubmit = async () => {
    const text = description.trim();
    if (!categoryId) {
      setError('Выберите раздел сайта');
      return;
    }
    if (!text) {
      setError('Опишите ошибку');
      return;
    }
    if (saving || uploading) return;

    setSaving(true);
    setError(null);
    try {
      await createBugReport({
        categoryId,
        description: text,
        fileIds: shots.map(s => s.fileId),
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить сообщение');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-labelledby="bug-report-title">
        <div className={styles.modalHeader}>
          <span id="bug-report-title" className={styles.modalTitle}>
            Сообщить об ошибке
          </span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.modalBody}>
          {done ? (
            <div className={styles.success}>
              Спасибо! Сообщение отправлено. Мы разберёмся с ошибкой.
            </div>
          ) : (
            <>
              <p className={styles.hint}>
                Укажите раздел, опишите проблему и при необходимости приложите скриншот.
              </p>

              <div className={styles.field}>
                <span className={styles.label}>Раздел сайта *</span>
                <Select
                  value={categoryId}
                  onChange={setCategoryId}
                  disabled={loadingCats || categories.length === 0}
                  placeholder={loadingCats ? 'Загрузка...' : 'Выберите раздел'}
                  options={categories.map(c => ({ value: c.id, label: c.name }))}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="bug-description">
                  Описание *
                </label>
                <textarea
                  id="bug-description"
                  className={styles.textarea}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Что произошло? Что вы ожидали увидеть?"
                  rows={5}
                  disabled={saving}
                />
              </div>

              <div className={styles.field}>
                <span className={styles.label}>Скриншоты</span>
                <div className={styles.screenshots}>
                  {shots.map(shot => (
                    <div key={shot.fileId} className={styles.thumb}>
                      <img src={shot.previewUrl} alt="" className={styles.thumbImg} />
                      <button
                        type="button"
                        className={styles.removeThumb}
                        onClick={() => removeShot(shot.fileId)}
                        aria-label="Удалить скриншот"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {shots.length < MAX_FILES && (
                    <button
                      type="button"
                      className={styles.addShot}
                      disabled={uploading || saving}
                      onClick={() => inputRef.current?.click()}
                    >
                      {uploading ? '...' : '+'}
                      <span>{uploading ? 'Загрузка' : 'Фото'}</span>
                    </button>
                  )}
                </div>
                <span className={styles.uploadHint}>
                  JPG, PNG, WEBP · до 10 МБ · максимум {MAX_FILES}
                </span>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className={styles.hiddenInput}
                  onChange={e => void handleFiles(e.target.files)}
                />
              </div>

              {error && <div className={styles.error}>{error}</div>}
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          {done ? (
            <button type="button" className={styles.saveBtn} onClick={onClose}>
              Закрыть
            </button>
          ) : (
            <>
              <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={saving}>
                Отмена
              </button>
              <button
                type="button"
                className={styles.saveBtn}
                onClick={() => void handleSubmit()}
                disabled={saving || uploading || loadingCats || !categories.length}
              >
                {saving ? 'Отправка...' : 'Отправить'}
              </button>
            </>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
