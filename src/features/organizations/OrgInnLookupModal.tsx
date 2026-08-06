// features/organizations/OrgInnLookupModal.tsx
// Поиск организации в реестре по ИНН и выбор записи для автозаполнения

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  formatLegalForm,
  formatRegistryStatus,
  lookupOrganizationByInn,
  type OrganizationRegistryParty,
} from '@/entities/organization';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import styles from './OrgInnLookupModal.module.css';

interface Props {
  initialInn?: string;
  onClose: () => void;
  onSelect: (party: OrganizationRegistryParty) => void;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function isValidInn(inn: string): boolean {
  return inn.length === 10 || inn.length === 12;
}

export function OrgInnLookupModal({ initialInn = '', onClose, onSelect }: Props) {
  useModalBackButton(onClose);

  const [innQuery, setInnQuery] = useState(digitsOnly(initialInn));
  const [results, setResults] = useState<OrganizationRegistryParty[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const cleaned = digitsOnly(initialInn);
    if (!isValidInn(cleaned)) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await lookupOrganizationByInn(cleaned);
        if (cancelled) return;
        setResults(list);
        setSelectedIdx(0);
        setSearched(true);
        if (list.length === 0) setError('По этому ИНН ничего не найдено');
      } catch (e) {
        if (!cancelled) {
          setResults([]);
          setSearched(true);
          setError(e instanceof Error ? e.message : 'Не удалось выполнить поиск');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [initialInn]);

  const runSearch = async () => {
    const cleaned = digitsOnly(innQuery);
    setInnQuery(cleaned);
    if (!isValidInn(cleaned)) {
      setError('ИНН должен содержать 10 или 12 цифр');
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const list = await lookupOrganizationByInn(cleaned);
      setResults(list);
      setSelectedIdx(0);
      if (list.length === 0) setError('По этому ИНН ничего не найдено');
    } catch (e) {
      setResults([]);
      setError(e instanceof Error ? e.message : 'Не удалось выполнить поиск');
    } finally {
      setLoading(false);
    }
  };

  const selected = results[selectedIdx] ?? null;

  const handleConfirm = () => {
    if (!selected) return;
    onSelect(selected);
  };

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="org-inn-lookup-title"
      >
        <div className={styles.header}>
          <h2 id="org-inn-lookup-title" className={styles.title}>
            Поиск по ИНН
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <p className={styles.hint}>
          Найдём организацию в реестре и подставим юридические данные в форму
        </p>

        <div className={styles.searchRow}>
          <input
            className={styles.input}
            value={innQuery}
            inputMode="numeric"
            autoComplete="off"
            placeholder="ИНН (10 или 12 цифр)"
            onChange={e => setInnQuery(digitsOnly(e.target.value).slice(0, 12))}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void runSearch();
              }
            }}
          />
          <button
            type="button"
            className={styles.searchBtn}
            disabled={loading || !innQuery}
            onClick={() => { void runSearch(); }}
          >
            {loading ? 'Поиск...' : 'Найти'}
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.results}>
          {loading && <div className={styles.empty}>Ищем в реестре...</div>}
          {!loading && searched && results.length === 0 && !error && (
            <div className={styles.empty}>Ничего не найдено</div>
          )}
          {!loading && results.map((party, idx) => {
            const title = party.name || party.fullName || `ИНН ${party.inn ?? '—'}`;
            const subtitle = party.fullName && party.name && party.fullName !== party.name
              ? party.fullName
              : null;
            return (
              <button
                key={`${party.inn ?? 'x'}-${party.ogrn ?? idx}-${idx}`}
                type="button"
                className={`${styles.resultCard} ${idx === selectedIdx ? styles.resultCardSelected : ''}`}
                onClick={() => setSelectedIdx(idx)}
              >
                <div className={styles.resultTop}>
                  <span className={styles.resultName}>{title}</span>
                  <span
                    className={`${styles.statusBadge} ${party.isActive ? styles.statusOk : styles.statusWarn}`}
                  >
                    {formatRegistryStatus(party.status)}
                  </span>
                </div>
                {subtitle && <div className={styles.resultLine}>{subtitle}</div>}
                <div className={styles.resultMeta}>
                  {party.inn && <span>ИНН {party.inn}</span>}
                  {party.ogrn && <span>ОГРН {party.ogrn}</span>}
                  {party.kpp && <span>КПП {party.kpp}</span>}
                  {party.legalForm && <span>{formatLegalForm(party.legalForm)}</span>}
                </div>
                {party.legalAddress && (
                  <div className={styles.resultLine}>{party.legalAddress}</div>
                )}
                {(party.headName || party.headPost) && (
                  <div className={styles.resultLine}>
                    {[party.headName, party.headPost].filter(Boolean).join(' · ')}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            disabled={!selected}
            onClick={handleConfirm}
          >
            Подтвердить
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
