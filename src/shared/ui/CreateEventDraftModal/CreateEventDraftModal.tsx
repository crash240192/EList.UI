// shared/ui/CreateEventDraftModal/CreateEventDraftModal.tsx

import styles from './CreateEventDraftModal.module.css';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';

interface Props {
  onCreateNew: () => void;
  onContinue: () => void;
  onCancel: () => void;
}

export function CreateEventDraftModal({ onCreateNew, onContinue, onCancel }: Props) {
  useModalBackButton(onCancel);
  return (
    <>
      <div className={styles.backdrop} onClick={onCancel} />
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="create-event-draft-title">
        <p className={styles.title} id="create-event-draft-title">
          У вас остались несохраненные изменения.
          <br />
          Продолжить заполнение?
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.newBtn} onClick={onCreateNew}>
            Создать новое
          </button>
          <button type="button" className={styles.continueBtn} onClick={onContinue}>
            Продолжить
          </button>
        </div>
      </div>
    </>
  );
}
