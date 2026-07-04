import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import styles from './AuthRequiredDialog.module.css';

interface AuthRequiredDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  returnTo?: string;
}

export function AuthRequiredDialog({
  open,
  onClose,
  title = 'Требуется авторизация',
  message = 'Войдите в аккаунт, чтобы выполнить это действие.',
  returnTo,
}: AuthRequiredDialogProps) {
  const navigate = useNavigate();

  useModalBackButton(onClose, open);

  if (!open) return null;

  const handleLogin = () => {
    onClose();
    navigate('/login', { state: { from: returnTo ?? window.location.pathname } });
  };

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden />
      <div className={styles.modal} role="dialog" aria-modal aria-labelledby="auth-required-title">
        <p id="auth-required-title" className={styles.title}>{title}</p>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Отмена
          </button>
          <button type="button" className={styles.loginBtn} onClick={handleLogin}>
            Войти
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
