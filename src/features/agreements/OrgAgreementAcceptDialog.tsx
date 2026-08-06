// features/agreements/OrgAgreementAcceptDialog.tsx
// Последовательное принятие актуальных документов от имени организации

import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  agreeOrganizationDocument,
  type DocumentTypeValue,
} from '@/entities/agreement';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { AgreementDocumentHtml } from './AgreementDocumentHtml';
import {
  orgAgreementConsentLabel,
  type PendingOrgAgreement,
} from './orgEventAgreements';
import styles from './UserAgreementsGate.module.css';

interface Props {
  organizationId: string;
  organizationName?: string;
  queue: PendingOrgAgreement[];
  onComplete: () => void;
  onCancel: () => void;
}

export function OrgAgreementAcceptDialog({
  organizationId,
  organizationName,
  queue,
  onComplete,
  onCancel,
}: Props) {
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalBackButton(onCancel);

  const current = queue[index] ?? null;
  if (!current) return null;

  const handleOk = async () => {
    if (!checked) {
      setError('Отметьте согласие с документом');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await agreeOrganizationDocument(organizationId, current.type);
      const next = index + 1;
      if (next < queue.length) {
        setIndex(next);
        setChecked(false);
      } else {
        onComplete();
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Не удалось сохранить согласие. Принять соглашение может владелец организации в настройках.',
      );
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
        aria-labelledby="org-reconsent-title"
      >
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 id="org-reconsent-title" className={styles.title}>
              {current.document.header || 'Обновление соглашения организации'}
            </h2>
            <p className={styles.stepHint}>
              {organizationName
                ? `От имени «${organizationName}»`
                : 'От имени организации'}
              {queue.length > 1 ? ` · документ ${index + 1} из ${queue.length}` : ''}
            </p>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.textPanel}>
            <AgreementDocumentHtml html={current.document.text} />
          </div>
        </div>

        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={checked}
            disabled={submitting}
            onChange={e => setChecked(e.target.checked)}
          />
          <span>{orgAgreementConsentLabel(current.type as DocumentTypeValue)}</span>
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
