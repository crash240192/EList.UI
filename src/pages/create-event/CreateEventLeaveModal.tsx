// pages/create-event/CreateEventLeaveModal.tsx

import styles from './CreateEventLeaveModal.module.css';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';

interface Props {
  onReset: () => void;
  onStay: () => void;
}

export function CreateEventLeaveModal({ onReset, onStay }: Props) {
  useModalBackButton(onStay);
  return (
    <>
      <div className={styles.backdrop} onClick={onStay} />
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="create-event-leave-title">
        <p className={styles.title} id="create-event-leave-title">
          Сбросить изменения и покинуть страницу?
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.resetBtn} onClick={onReset}>
            Сбросить
          </button>
          <button type="button" className={styles.stayBtn} onClick={onStay}>
            Остаться
          </button>
        </div>
      </div>
    </>
  );
}
