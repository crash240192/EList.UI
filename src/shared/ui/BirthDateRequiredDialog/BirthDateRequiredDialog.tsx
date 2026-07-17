import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import styles from './BirthDateRequiredDialog.module.css';

interface BirthDateRequiredDialogProps {
  open: boolean;
  onClose: () => void;
}

export function BirthDateRequiredDialog({
  open,
  onClose,
}: BirthDateRequiredDialogProps) {
  const navigate = useNavigate();
  useModalBackButton(onClose, open);

  if (!open) return null;

  const goToSettings = () => {
    onClose();
    navigate('/settings');
  };

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden />
      <div className={styles.modal} role="dialog" aria-modal aria-labelledby="birth-date-required-title">
        <p id="birth-date-required-title" className={styles.title}>Укажите дату рождения</p>
        <p className={styles.message}>
          Чтобы фильтровать мероприятия 18+, заполните дату рождения в настройках профиля.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Отмена
          </button>
          <button type="button" className={styles.settingsBtn} onClick={goToSettings}>
            Перейти в настройки
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
