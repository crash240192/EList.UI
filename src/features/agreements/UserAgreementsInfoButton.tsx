// features/agreements/UserAgreementsInfoButton.tsx
// Информационная кнопка в хедере: 3 пользовательских документа + факт согласия

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DocumentType,
  DOCUMENT_TYPE_LABELS,
  checkUserAgreement,
  fetchLastDocument,
  type DocumentTypeValue,
  type IAgreementDocument,
} from '@/entities/agreement';
import { useAuthStore } from '@/app/store';
import { AgreementDocumentModal } from './AgreementDocumentModal';
import styles from './UserAgreementsInfoButton.module.css';

const USER_DOCUMENT_TYPES: DocumentTypeValue[] = [
  DocumentType.Policy,
  DocumentType.Consent,
  DocumentType.Agreement,
];

type ConsentState = 'unknown' | 'yes' | 'no' | 'guest';

interface DocRow {
  type: DocumentTypeValue;
  label: string;
  document: IAgreementDocument | null;
  consent: ConsentState;
}

function labelFor(type: DocumentTypeValue): string {
  return DOCUMENT_TYPE_LABELS.find(x => x.value === type)?.label ?? String(type);
}

export function UserAgreementsInfoButton() {
  const authenticated = useAuthStore(s => s.isAuthenticated());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<DocRow[]>([]);
  const [viewDoc, setViewDoc] = useState<IAgreementDocument | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next: DocRow[] = [];
      for (const type of USER_DOCUMENT_TYPES) {
        const document = await fetchLastDocument(type).catch(() => null);
        let consent: ConsentState = 'guest';
        if (authenticated) {
          try {
            consent = (await checkUserAgreement(type)) ? 'yes' : 'no';
          } catch {
            consent = 'unknown';
          }
        }
        next.push({
          type,
          label: labelFor(type),
          document,
          consent,
        });
      }
      setRows(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить документы');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !viewDoc) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, viewDoc]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.infoBtn} ${open ? styles.infoBtnOpen : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-label="Документы и согласия"
        aria-expanded={open}
        title="Документы и согласия"
      >
        <InfoIcon />
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Документы и согласия">
          <div className={styles.head}>
            <h2 className={styles.title}>Документы и согласия</h2>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setOpen(false)}
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>

          {!authenticated && (
            <p className={styles.hint}>
              Войдите в аккаунт, чтобы увидеть, какие документы вы приняли.
            </p>
          )}

          {error && <div className={styles.error}>{error}</div>}

          {loading ? (
            <div className={styles.loader}>Загрузка...</div>
          ) : rows.length === 0 ? (
            <div className={styles.empty}>Документы пока недоступны</div>
          ) : (
            <ul className={styles.list}>
              {rows.map(row => (
                <li key={row.type} className={styles.row}>
                  <div className={styles.rowTop}>
                    <span className={styles.docName}>{row.label}</span>
                    <span
                      className={`${styles.status} ${
                        row.consent === 'yes'
                          ? styles.statusOk
                          : row.consent === 'no'
                            ? styles.statusNo
                            : styles.statusMute
                      }`}
                    >
                      {row.consent === 'yes'
                        ? 'Принято'
                        : row.consent === 'no'
                          ? 'Не принято'
                          : row.consent === 'guest'
                            ? '—'
                            : 'Нет данных'}
                    </span>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.viewBtn}
                      disabled={!row.document}
                      onClick={() => {
                        if (row.document) setViewDoc(row.document);
                      }}
                    >
                      {row.document ? 'Открыть' : 'Нет документа'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {viewDoc && (
        <AgreementDocumentModal
          doc={viewDoc}
          onClose={() => setViewDoc(null)}
        />
      )}
    </div>
  );
}

function InfoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
