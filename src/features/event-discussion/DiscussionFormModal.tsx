import { useState } from 'react';
import { createPortal } from 'react-dom';
import { createConversation } from '@/entities/conversation';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import styles from './DiscussionFormModal.module.css';

interface DiscussionFormModalProps {
  eventId: string;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}

export function DiscussionFormModal({ eventId, onClose, onCreated }: DiscussionFormModalProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalBackButton(onClose);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const conversationId = await createConversation({ name: trimmed, eventId });
      onCreated(conversationId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать обсуждение');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-labelledby="discussion-form-title">
        <div className={styles.modalHeader}>
          <span id="discussion-form-title" className={styles.modalTitle}>Новое обсуждение</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="discussion-name">Название *</label>
            <input
              id="discussion-name"
              className={styles.input}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Например: Вопросы по участию"
              onFocus={e => e.target.select()}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
            />
          </div>
          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={saving}>Отмена</button>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={() => void handleCreate()}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
