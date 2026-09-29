// pages/create-event/CreateEventLeaveModal.tsx

import styles from './CreateEventLeaveModal.module.css';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';

interface Props {
  title?: string;
  resetLabel?: string;
  stayLabel?: string;
  titleId?: string;
  onReset: () => void;
  onStay: () => void;
}

export function CreateEventLeaveModal({
  title = 'Сбросить изменения и покинуть страницу?',
  resetLabel = 'Сбросить',
  stayLabel = 'Остаться',
  titleId = 'create-event-leave-title',
  onReset,
  onStay,
}: Props) {
  useModalBackButton(onStay);
  return (
    <>
      <div className={styles.backdrop} onClick={onStay} />
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <p className={styles.title} id={titleId}>
          {title}
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.resetBtn} onClick={onReset}>
            {resetLabel}
          </button>
          <button type="button" className={styles.stayBtn} onClick={onStay}>
            {stayLabel}
          </button>
        </div>
      </div>
    </>
  );
}
