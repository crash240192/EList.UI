import { Fragment, useState } from 'react';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import {
  SIMILAR_EVENT_FIELDS,
  type SimilarEventField,
} from '@/pages/create-event/similarEventSeed';
import styles from './SimilarEventDialog.module.css';

interface SimilarEventDialogProps {
  onClose: () => void;
  onConfirm: (fields: SimilarEventField[]) => Promise<void>;
}

const LEFT = SIMILAR_EVENT_FIELDS.filter(field => field.column === 'left');
const RIGHT = SIMILAR_EVENT_FIELDS.filter(field => field.column === 'right');

export function SimilarEventDialog({ onClose, onConfirm }: SimilarEventDialogProps) {
  const [selected, setSelected] = useState<Set<SimilarEventField>>(
    () => new Set(SIMILAR_EVENT_FIELDS.map(field => field.id)),
  );
  const [busy, setBusy] = useState(false);

  useModalBackButton(() => {
    if (!busy) onClose();
  });

  const toggle = (id: SimilarEventField) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm([...selected]);
    } catch {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={styles.backdrop} onClick={() => { if (!busy) onClose(); }} aria-hidden />
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="similar-event-title">
        <h2 id="similar-event-title" className={styles.title}>Сохранить следующие поля:</h2>
        <div className={styles.grid}>
          {LEFT.map((field, index) => {
            const right = RIGHT[index];
            return (
              <Fragment key={field.id}>
                <label className={styles.item}>
                  <input
                    className={styles.check}
                    type="checkbox"
                    checked={selected.has(field.id)}
                    onChange={() => toggle(field.id)}
                  />
                  <span>{field.label}</span>
                </label>
                <label className={styles.item}>
                  <input
                    className={styles.check}
                    type="checkbox"
                    checked={selected.has(right.id)}
                    onChange={() => toggle(right.id)}
                  />
                  <span>{right.label}</span>
                </label>
              </Fragment>
            );
          })}
        </div>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy}
            onClick={() => setSelected(new Set(SIMILAR_EVENT_FIELDS.map(field => field.id)))}
          >
            <input className={styles.check} type="checkbox" checked readOnly tabIndex={-1} aria-hidden />
            <span>Выбрать все</span>
          </button>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy}
            onClick={() => setSelected(new Set())}
          >
            <input className={styles.emptyCheck} type="checkbox" checked={false} readOnly tabIndex={-1} aria-hidden />
            <span>Снять все</span>
          </button>
        </div>
        <button type="button" className={styles.primary} disabled={busy} onClick={() => void handleConfirm()}>
          Создать аналогичное
        </button>
      </div>
    </>
  );
}
