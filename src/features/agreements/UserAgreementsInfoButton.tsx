// features/agreements/UserAgreementsInfoButton.tsx
// Информационная кнопка в хедере: пользовательские документы + факт согласия

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DocumentType,
  DOCUMENT_TYPE_LABELS,
  SERVICE_REQUIRED_DOCUMENT_TYPES,
  checkUserAgreement,
  documentRequiresConsent,
  fetchLastDocument,
  type DocumentTypeValue,
  type IAgreementDocument,
} from '@/entities/agreement';
import { useAuthStore } from '@/app/store';
import { AgreementDocumentModal } from './AgreementDocumentModal';
import {
  UserAgreementAcceptDialog,
  type PendingUserAgreement,
} from './UserAgreementAcceptDialog';
import styles from './UserAgreementsInfoButton.module.css';

const USER_DOCUMENT_TYPES: DocumentTypeValue[] = [
  DocumentType.Policy,
  DocumentType.Consent,
  DocumentType.Agreement,
  DocumentType.DistributionConsent,
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

function parseMissingDocuments(detail: unknown): string[] {
  if (!detail || typeof detail !== 'object') return [];
  const missing = (detail as { missingDocuments?: unknown }).missingDocuments;
  if (!Array.isArray(missing)) return [];
  return missing.filter((x): x is string => typeof x === 'string');
}

interface UserAgreementsInfoButtonProps {
  /** Скрыть кнопку «i» — панель открывается снаружи */
  hideTrigger?: boolean;
  panelOpen?: boolean;
  onPanelOpenChange?: (open: boolean) => void;
}

export function UserAgreementsInfoButton({
  hideTrigger = false,
  panelOpen: panelOpenProp,
  onPanelOpenChange,
}: UserAgreementsInfoButtonProps = {}) {
  const authenticated = useAuthStore(s => s.isAuthenticated());
  const [internalOpen, setInternalOpen] = useState(false);
  const open = panelOpenProp ?? internalOpen;
  const setOpen = onPanelOpenChange ?? setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<DocRow[]>([]);
  const [viewDoc, setViewDoc] = useState<IAgreementDocument | null>(null);
  const [acceptItem, setAcceptItem] = useState<PendingUserAgreement | null>(null);
  const [highlight, setHighlight] = useState(false);
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

      if (authenticated) {
        const serviceMissing = next.some(
          row => SERVICE_REQUIRED_DOCUMENT_TYPES.includes(row.type) && row.consent === 'no',
        );
        setHighlight(serviceMissing);
      } else {
        setHighlight(false);
      }
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

  // Подсветка кнопки, если сервису не хватает Consent/Agreement (toast / gate).
  useEffect(() => {
    if (!authenticated) {
      setHighlight(false);
      return;
    }

    const refreshHighlight = async () => {
      try {
        let missing = false;
        for (const type of SERVICE_REQUIRED_DOCUMENT_TYPES) {
          const ok = await checkUserAgreement(type);
          if (!ok) {
            missing = true;
            break;
          }
        }
        setHighlight(missing);
      } catch {
        /* ignore */
      }
    };

    void refreshHighlight();

    const onRecheck = (e: Event) => {
      const names = parseMissingDocuments((e as CustomEvent).detail);
      if (names.length === 0) {
        void refreshHighlight();
        return;
      }
      const serviceMissing = names.some(name =>
        name === 'Consent' || name === 'Agreement' || name === '1' || name === '2',
      );
      setHighlight(serviceMissing);
      if (!serviceMissing) void refreshHighlight();
    };

    window.addEventListener('elist:recheck-agreements', onRecheck);
    return () => window.removeEventListener('elist:recheck-agreements', onRecheck);
  }, [authenticated]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (viewDoc || acceptItem) return;
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !viewDoc && !acceptItem) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, viewDoc, acceptItem, setOpen]);

  const openRow = (row: DocRow) => {
    if (!row.document) return;
    const needsAccept = authenticated
      && documentRequiresConsent(row.type, row.document.requiresAgreement)
      && row.consent !== 'yes';
    if (needsAccept) {
      setAcceptItem({ type: row.type, document: row.document });
      return;
    }
    setViewDoc(row.document);
  };

  const consentStatusLabel = (row: DocRow): string => {
    if (!documentRequiresConsent(row.type, row.document?.requiresAgreement)) return 'Информация';
    if (row.consent === 'yes') return 'Принято';
    if (row.consent === 'no') return 'Не принято';
    if (row.consent === 'guest') return '—';
    return 'Нет данных';
  };

  const consentStatusClass = (row: DocRow): string => {
    if (!documentRequiresConsent(row.type, row.document?.requiresAgreement)) return styles.statusInfo;
    if (row.consent === 'yes') return styles.statusOk;
    if (row.consent === 'no') return styles.statusNo;
    return styles.statusMute;
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      {!hideTrigger && (
      <button
        type="button"
        className={`${styles.infoBtn} ${open ? styles.infoBtnOpen : ''} ${highlight ? styles.infoBtnHighlight : ''}`}
        onClick={() => setOpen(!open)}
        aria-label="Условия использования"
        aria-expanded={open}
        title="Условия использования"
      >
        <InfoIcon />
      </button>
      )}

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Условия использования">
          <div className={styles.head}>
            <h2 className={styles.title}>Условия использования</h2>
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
              Войдите в аккаунт, чтобы принять документы. Можно открыть текст без входа.
            </p>
          )}

          {error && <div className={styles.error}>{error}</div>}

          {loading ? (
            <div className={styles.loader}>Загрузка...</div>
          ) : rows.length === 0 ? (
            <div className={styles.empty}>Документы пока недоступны</div>
          ) : (
            <ul className={styles.list}>
              {rows.map(row => {
                const clickable = !!row.document;
                return (
                  <li key={row.type}>
                    <button
                      type="button"
                      className={`${styles.row} ${clickable ? styles.rowClickable : styles.rowDisabled}`}
                      disabled={!clickable}
                      onClick={() => openRow(row)}
                    >
                      <div className={styles.rowTop}>
                        <span className={styles.docName}>{row.label}</span>
                        <span
                          className={`${styles.status} ${consentStatusClass(row)}`}
                        >
                          {consentStatusLabel(row)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
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

      {acceptItem && (
        <UserAgreementAcceptDialog
          item={acceptItem}
          onCancel={() => setAcceptItem(null)}
          onComplete={() => {
            setAcceptItem(null);
            void load();
            window.dispatchEvent(new Event('elist:recheck-agreements'));
          }}
        />
      )}
    </div>
  );
}

/** i в круге: точка — filled circle, иначе stroke-линия часто обрезается */
function InfoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="8" r="1.35" fill="currentColor" />
      <path
        d="M12 11v5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
