import styles from './ConfirmDialog.module.css';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';

interface ConfirmDialogProps {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Одна кнопка подтверждения; клик по фону тоже вызывает onConfirm */
  hideCancel?: boolean;
  variant?: 'danger' | 'accent';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Да',
  cancelLabel = 'Нет',
  hideCancel = false,
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useModalBackButton(hideCancel ? onConfirm : onCancel);

  const confirmClass =
    variant === 'accent' ? styles.confirmBtnAccent : styles.confirmBtnDanger;

  return (
    <>
      <div className={styles.backdrop} onClick={hideCancel ? onConfirm : onCancel} aria-hidden />
      <div className={styles.modal} role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <p id="confirm-dialog-title" className={styles.title}>
          {title}
        </p>
        {message && <p className={styles.message}>{message}</p>}
        <div className={styles.actions}>
          {!hideCancel && (
            <button type="button" className={styles.cancelBtn} onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            className={`${styles.confirmBtn} ${confirmClass}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
