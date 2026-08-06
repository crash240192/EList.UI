// features/agreements/UserAgreementAcceptDialog.tsx
// Принятие пользовательского документа с галочкой согласия

import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DocumentType,
  agreeDocument,
  type DocumentTypeValue,
  type IAgreementDocument,
} from '@/entities/agreement';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { AgreementDocumentHtml } from './AgreementDocumentHtml';
import styles from './UserAgreementsGate.module.css';

export interface PendingUserAgreement {
  type: DocumentTypeValue;
  document: IAgreementDocument;
}

interface Props {
  item: PendingUserAgreement;
  onComplete: () => void;
  onCancel: () => void;
}

function consentLabel(type: DocumentTypeValue): string {
  switch (type) {
    case DocumentType.Consent:
      return 'Согласен на обработку персональных данных';
    case DocumentType.Agreement:
      return 'Согласен с условиями пользовательского соглашения';
    case DocumentType.Policy:
      return 'Ознакомлен с политикой обработки персональных данных';
    default:
      return 'Принимаю условия документа';
  }
}

export function UserAgreementAcceptDialog({ item, onComplete, onCancel }: Props) {
  useModalBackButton(onCancel);

  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOk = async () => {
    if (!checked) {
      setError('Отметьте согласие с документом');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await agreeDocument(item.type);
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить согласие');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <>
      <div className={styles.backdrop} aria-hidden />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-reconsent-title"
      >
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 id="user-reconsent-title" className={styles.title}>
              {item.document.header || 'Документ'}
            </h2>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.textPanel}>
            <AgreementDocumentHtml html={item.document.text} />
          </div>
        </div>

        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={checked}
            disabled={submitting}
            onChange={e => setChecked(e.target.checked)}
          />
          <span>{consentLabel(item.type)}</span>
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={submitting}
          >
            Отмена
          </button>
          <button
            type="button"
            className={styles.okBtn}
            onClick={() => { void handleOk(); }}
            disabled={submitting || !checked}
          >
            {submitting ? 'Сохранение…' : 'Принять'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
