import { createPortal } from 'react-dom';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import styles from './AgeConfirmDialog.module.css';

interface AgeConfirmDialogProps {
  open: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onDecline: () => void;
}

export function AgeConfirmDialog({
  open,
  busy = false,
  onConfirm,
  onDecline,
}: AgeConfirmDialogProps) {
  useModalBackButton(onDecline, open);

  if (!open) return null;

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={busy ? undefined : onDecline} aria-hidden />
      <div className={styles.modal} role="dialog" aria-modal aria-labelledby="age-confirm-title">
        <p id="age-confirm-title" className={styles.title}>Вам исполнилось 18 лет?</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.yesBtn}
            onClick={onConfirm}
            disabled={busy}
          >
            Да, мне уже есть 18
          </button>
          <button
            type="button"
            className={styles.noBtn}
            onClick={onDecline}
            disabled={busy}
          >
            Ещё нет
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
