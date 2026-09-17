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
const PARTNERSHIP_EXTS = ['.docx', '.xlsx', '.pdf'];

type SupportTopic = 'bug' | 'suggestion' | 'partnership';

const TOPIC_OPTIONS: { value: SupportTopic; label: string }[] = [
  { value: 'bug', label: 'Сообщить об ошибке' },
  { value: 'suggestion', label: 'Направить предложение по доработке' },
  { value: 'partnership', label: 'По вопросам рекламы и сотрудничества' },
];

interface Shot {
  fileId: string;
  previewUrl: string;
}

interface LocalDoc {
  id: string;
  name: string;
}

interface BugReportModalProps {
  onClose: () => void;
}

function isAllowedPartnershipFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return PARTNERSHIP_EXTS.some(ext => name.endsWith(ext));
}

export function BugReportModal({ onClose }: BugReportModalProps) {
  const [topic, setTopic] = useState<SupportTopic | ''>('');
  const [categories, setCategories] = useState<IBugReportCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [shots, setShots] = useState<Shot[]>([]);
  const [docs, setDocs] = useState<LocalDoc[]>([]);
  const [contactName, setContactName] = useState('');
  const [contactOrg, setContactOrg] = useState('');
  const [contactReach, setContactReach] = useState('');
  const [loadingCats, setLoadingCats] = useState(false);
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
    if (topic === 'bug' || topic === 'suggestion') {
      void loadCategories();
    }
  }, [topic, loadCategories]);

  const clearShots = () => {
    setShots(prev => {
      for (const shot of prev) URL.revokeObjectURL(shot.previewUrl);
      return [];
    });
  };

  const changeTopic = (next: string) => {
    const value = next as SupportTopic | '';
    setTopic(value === 'bug' || value === 'suggestion' || value === 'partnership' ? value : '');
    setDescription('');
    setCategoryId('');
    setDocs([]);
    setContactName('');
    setContactOrg('');
    setContactReach('');
    setError(null);
    setDone(false);
    clearShots();
  };

  const handleImageFiles = async (files: FileList | null, upload: boolean) => {
    if (!files?.length) return;
    const remaining = MAX_FILES - shots.length;
    if (remaining <= 0) {
      setError(`Можно приложить не больше ${MAX_FILES} скриншотов`);
      return;
    }

    const batch = Array.from(files).slice(0, remaining);
    setUploading(upload);
    setError(null);
    try {
      const next: Shot[] = [];
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
        if (upload) {
          const result = await uploadFile(file);
          next.push({ fileId: result.id, previewUrl });
        } else {
          next.push({ fileId: `${file.name}-${file.size}-${file.lastModified}`, previewUrl });
        }
      }
      if (next.length) {
        setShots(prev => [...prev, ...next].slice(0, MAX_FILES));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки файла');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDocFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    if (!isAllowedPartnershipFile(file)) {
      setError('Только файлы DOCX, XLSX или PDF');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('Файл слишком большой (макс. 10 МБ)');
      return;
    }
    setError(null);
    setDocs([{ id: `${file.name}-${file.size}-${file.lastModified}`, name: file.name }]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeShot = (fileId: string) => {
    setShots(prev => {
      const removed = prev.find(s => s.fileId === fileId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter(s => s.fileId !== fileId);
    });
  };

  const handleSubmit = async () => {
    if (topic !== 'bug') return;

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

  const sendDisabled =
    !topic
    || (topic === 'bug' && (saving || uploading || loadingCats || !categories.length));

  const descriptionPlaceholder =
    topic === 'suggestion'
      ? 'Ваше предложение по доработке'
      : topic === 'partnership'
        ? 'Ваше предложение по сотрудничеству'
        : 'Что произошло? Что вы ожидали увидеть?';

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-labelledby="support-modal-title">
        <div className={styles.modalHeader}>
          <span id="support-modal-title" className={styles.modalTitle}>
            Написать в поддержку
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
              <div className={styles.field}>
                <span className={styles.label}>Тема обращения</span>
                <Select
                  value={topic}
                  onChange={changeTopic}
                  placeholder="Выберите тему"
                  options={TOPIC_OPTIONS}
                />
              </div>

              {(topic === 'bug' || topic === 'suggestion') && (
                <>
                  <p className={styles.hint}>
                    {topic === 'bug'
                      ? 'Укажите раздел, опишите проблему и при необходимости приложите скриншот.'
                      : 'Укажите раздел, опишите предложение и при необходимости приложите скриншот.'}
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
                    <label className={styles.label} htmlFor="support-description">
                      Описание *
                    </label>
                    <textarea
                      id="support-description"
                      className={styles.textarea}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder={descriptionPlaceholder}
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
                      onChange={e => void handleImageFiles(e.target.files, topic === 'bug')}
                    />
                  </div>
                </>
              )}

              {topic === 'partnership' && (
                <>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="support-partnership-text">
                      Описание *
                    </label>
                    <textarea
                      id="support-partnership-text"
                      className={styles.textarea}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder={descriptionPlaceholder}
                      rows={5}
                    />
                  </div>

                  <span className={styles.sectionTitle}>Ваши контактные данные</span>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="support-contact-name">
                      Ваше имя *
                    </label>
                    <input
                      id="support-contact-name"
                      className={styles.input}
                      value={contactName}
                      onChange={e => setContactName(e.target.value)}
                      placeholder="Как к вам обращаться"
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="support-contact-org">
                      Название вашей организации
                    </label>
                    <input
                      id="support-contact-org"
                      className={styles.input}
                      value={contactOrg}
                      onChange={e => setContactOrg(e.target.value)}
                      placeholder="Необязательно"
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="support-contact-reach">
                      E-mail / номер телефона
                    </label>
                    <input
                      id="support-contact-reach"
                      className={styles.input}
                      value={contactReach}
                      onChange={e => setContactReach(e.target.value)}
                      placeholder="Как с вами связаться"
                    />
                  </div>

                  <div className={styles.field}>
                    <span className={styles.sectionTitle}>Прикрепить файл</span>
                    <div className={styles.screenshots}>
                      {docs.map(doc => (
                        <div key={doc.id} className={styles.fileChip}>
                          <span className={styles.fileChipName}>{doc.name}</span>
                          <button
                            type="button"
                            className={styles.fileChipRemove}
                            onClick={() => setDocs([])}
                            aria-label="Удалить файл"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {docs.length === 0 && (
                        <button
                          type="button"
                          className={styles.addShot}
                          onClick={() => inputRef.current?.click()}
                        >
                          +
                          <span>Файл</span>
                        </button>
                      )}
                    </div>
                    <span className={styles.uploadHint}>DOCX, XLSX, PDF · до 10 МБ</span>
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".docx,.xlsx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className={styles.hiddenInput}
                      onChange={e => handleDocFiles(e.target.files)}
                    />
                  </div>
                </>
              )}

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
                onClick={() => { void handleSubmit(); }}
                disabled={sendDisabled}
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
