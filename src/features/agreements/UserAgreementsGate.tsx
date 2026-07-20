// features/agreements/UserAgreementsGate.tsx
// После входа / при открытии приложения: проверка актуальности Consent и Agreement

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
import styles from './UserAgreementsGate.module.css';

const CHECK_TYPES: DocumentTypeValue[] = [DocumentType.Consent, DocumentType.Agreement];

interface PendingDoc {
  type: DocumentTypeValue;
  document: IAgreementDocument;
  checked: boolean;
}

interface UserAgreementsGateProps {
  /** Блокирует контент приложения, пока согласия не подтверждены */
  children?: React.ReactNode;
}

export function UserAgreementsGate({ children }: UserAgreementsGateProps) {
  const authenticated = useAuthStore(s => s.isAuthenticated());
  const activationRequired = useAuthStore(s => s.activationRequired);
  const logout = useAuthStore(s => s.logout);

  const [pending, setPending] = useState<PendingDoc[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    if (!authenticated || activationRequired) {
      setPending(null);
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const outdated: PendingDoc[] = [];
      for (const type of CHECK_TYPES) {
        const ok = await checkUserAgreement(type);
        if (ok) continue;
        const document = await fetchLastDocument(type);
        if (!document) continue;
        outdated.push({ type, document, checked: false });
      }
      setPending(outdated.length > 0 ? outdated : null);
    } catch {
      // Не блокируем приложение при сетевой ошибке проверки
      setPending(null);
    } finally {
      setChecking(false);
    }
  }, [authenticated, activationRequired]);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const setChecked = (type: DocumentTypeValue, checked: boolean) => {
    setPending(list =>
      list ? list.map(item => (item.type === type ? { ...item, checked } : item)) : list,
    );
  };

  const handleCancel = () => {
    logout();
    setPending(null);
  };

  const handleOk = async () => {
    if (!pending || pending.some(p => !p.checked)) {
      setError('Отметьте согласие со всеми документами');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      for (const item of pending) {
        await agreeDocument(item.type);
      }
      setPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить согласие');
    } finally {
      setSubmitting(false);
    }
  };

  const blocking = Boolean(pending && pending.length > 0);

  return (
    <>
      {children}
      {blocking && pending && (
        <ReconsentDialog
          items={pending}
          error={error}
          busy={submitting || checking}
          onToggle={setChecked}
          onOk={() => { void handleOk(); }}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}

function ReconsentDialog({
  items,
  error,
  busy,
  onToggle,
  onOk,
  onCancel,
}: {
  items: PendingDoc[];
  error: string | null;
  busy: boolean;
  onToggle: (type: DocumentTypeValue, checked: boolean) => void;
  onOk: () => void;
  onCancel: () => void;
}) {
  useModalBackButton(onCancel);

  return createPortal(
    <>
      <div className={styles.backdrop} aria-hidden />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reconsent-title"
      >
        <h2 id="reconsent-title" className={styles.title}>
          Обновление пользовательских соглашений
        </h2>
        <p className={styles.lead}>
          Появились новые версии документов. Ознакомьтесь с ними и подтвердите согласие,
          чтобы продолжить работу.
        </p>

        <div className={styles.docs}>
          {items.map(item => (
            <section key={item.type} className={styles.docBlock}>
              <h3 className={styles.docHeader}>{item.document.header}</h3>
              <div className={styles.docText}>{item.document.text}</div>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={item.checked}
                  disabled={busy}
                  onChange={e => onToggle(item.type, e.target.checked)}
                />
                <span>
                  {item.type === DocumentType.Consent
                    ? 'Согласен на обработку персональных данных'
                    : 'Согласен с условиями пользовательского соглашения'}
                </span>
              </label>
            </section>
          ))}
        </div>

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
            disabled={busy || items.some(i => !i.checked)}
          >
            {busy ? 'Сохранение…' : 'ОК'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
