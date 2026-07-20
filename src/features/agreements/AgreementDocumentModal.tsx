// features/agreements/AgreementDocumentModal.tsx — просмотр текста документа соглашения

import { createPortal } from 'react-dom';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import type { IAgreementDocument } from '@/entities/agreement';
import styles from './AgreementDocumentModal.module.css';

interface AgreementDocumentModalProps {
  doc: IAgreementDocument | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
}

export function AgreementDocumentModal({
  doc,
  loading = false,
  error = null,
  onClose,
}: AgreementDocumentModalProps) {
  useModalBackButton(onClose);

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agreement-doc-title"
      >
        <div className={styles.header}>
          <h2 id="agreement-doc-title" className={styles.title}>
            {doc?.header || (loading ? 'Загрузка…' : 'Документ')}
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className={styles.body}>
          {loading && <p className={styles.hint}>Загрузка документа…</p>}
          {!loading && error && <p className={styles.error}>{error}</p>}
          {!loading && !error && doc && (
            <div className={styles.text}>{doc.text}</div>
          )}
        </div>
        <div className={styles.footer}>
          <button type="button" className={styles.okBtn} onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
