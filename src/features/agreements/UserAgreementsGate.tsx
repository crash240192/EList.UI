// features/agreements/UserAgreementsGate.tsx
// После входа / при открытии приложения: проверка актуальности Consent и Agreement
// Устаревшие документы показываются по одному, последовательно

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DocumentType,
  agreeDocument,
  checkUserAgreement,
  fetchLastDocument,
  type DocumentTypeValue,
  type IAgreementDocument,
} from '@/entities/agreement';
import { useAuthStore } from '@/app/store';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { AgreementDocumentHtml } from './AgreementDocumentHtml';
import styles from './UserAgreementsGate.module.css';

const CHECK_TYPES: DocumentTypeValue[] = [DocumentType.Consent, DocumentType.Agreement];

interface PendingDoc {
  type: DocumentTypeValue;
  document: IAgreementDocument;
}

interface UserAgreementsGateProps {
  children?: React.ReactNode;
}

export function UserAgreementsGate({ children }: UserAgreementsGateProps) {
  const authenticated = useAuthStore(s => s.isAuthenticated());
  const activationRequired = useAuthStore(s => s.activationRequired);
  const logout = useAuthStore(s => s.logout);

  const [queue, setQueue] = useState<PendingDoc[]>([]);
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    if (!authenticated || activationRequired) {
      setQueue([]);
      setIndex(0);
      return;
    }
    setError(null);
    try {
      const outdated: PendingDoc[] = [];
      for (const type of CHECK_TYPES) {
        const ok = await checkUserAgreement(type);
        if (ok) continue;
        const document = await fetchLastDocument(type);
        if (!document) continue;
        outdated.push({ type, document });
      }
      setQueue(outdated);
      setIndex(0);
      setChecked(false);
    } catch {
      setQueue([]);
      setIndex(0);
    }
  }, [authenticated, activationRequired]);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const current = queue[index] ?? null;

  const handleCancel = () => {
    logout();
    setQueue([]);
    setIndex(0);
    setChecked(false);
    setError(null);
  };

  const handleOk = async () => {
    if (!current) return;
    if (!checked) {
      setError('Отметьте согласие с документом');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await agreeDocument(current.type);
      const next = index + 1;
      if (next < queue.length) {
        setIndex(next);
        setChecked(false);
      } else {
        setQueue([]);
        setIndex(0);
        setChecked(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить согласие');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {children}
      {current && (
        <ReconsentDialog
          item={current}
          step={index + 1}
          total={queue.length}
          checked={checked}
          error={error}
          busy={submitting}
          onToggle={setChecked}
          onOk={() => { void handleOk(); }}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}

function ReconsentDialog({
  item,
  step,
  total,
  checked,
  error,
  busy,
  onToggle,
  onOk,
  onCancel,
}: {
  item: PendingDoc;
  step: number;
  total: number;
  checked: boolean;
  error: string | null;
  busy: boolean;
  onToggle: (checked: boolean) => void;
  onOk: () => void;
  onCancel: () => void;
}) {
  useModalBackButton(onCancel);

  const consentLabel = item.type === DocumentType.Consent
    ? 'Согласен на обработку персональных данных'
    : 'Согласен с условиями пользовательского соглашения';

  return createPortal(
    <>
      <div className={styles.backdrop} aria-hidden />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reconsent-title"
      >
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 id="reconsent-title" className={styles.title}>
              {item.document.header || 'Обновление соглашения'}
            </h2>
            {total > 1 && (
              <p className={styles.stepHint}>Документ {step} из {total}</p>
            )}
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
            disabled={busy}
            onChange={e => onToggle(e.target.checked)}
          />
          <span>{consentLabel}</span>
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={busy}
          >
            Отмена
          </button>
          <button
            type="button"
            className={styles.okBtn}
            onClick={onOk}
            disabled={busy || !checked}
          >
            {busy ? 'Сохранение…' : 'ОК'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
