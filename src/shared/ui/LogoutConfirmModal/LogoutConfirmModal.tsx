// shared/ui/LogoutConfirmModal/LogoutConfirmModal.tsx

import styles from './LogoutConfirmModal.module.css';

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

export function LogoutConfirmModal({ onConfirm, onCancel }: Props) {
  return (
    <>
      <div className={styles.backdrop} onClick={onCancel} />
      <div className={styles.modal} role="dialog" aria-modal="true">
        <p className={styles.title}>Выйти из аккаунта?</p>
        <p className={styles.subtitle}>Вы будете перенаправлены на страницу входа</p>
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>Отмена</button>
          <button className={styles.confirmBtn} onClick={onConfirm}>Выйти</button>
        </div>
      </div>
    </>
  );
}
