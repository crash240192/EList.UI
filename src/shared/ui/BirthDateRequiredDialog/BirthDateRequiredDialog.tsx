import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { DatePicker } from '@/shared/ui/DatePicker/DatePicker';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { todayLocalDateString } from '@/shared/lib/datetime';
import styles from './BirthDateRequiredDialog.module.css';

interface BirthDateRequiredDialogProps {
  open: boolean;
  busy?: boolean;
  onSave: (birthDateLocal: string) => void | Promise<void>;
  onCancel: () => void;
}

export function BirthDateRequiredDialog({
  open,
  busy = false,
  onSave,
  onCancel,
}: BirthDateRequiredDialogProps) {
  const [birthDate, setBirthDate] = useState('');
  useModalBackButton(onCancel, open);

  useEffect(() => {
    if (open) setBirthDate('');
  }, [open]);

  if (!open) return null;

  const canSave = Boolean(birthDate) && !busy;

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={busy ? undefined : onCancel} aria-hidden />
      <div className={styles.modal} role="dialog" aria-modal aria-labelledby="birth-date-required-title">
        <p id="birth-date-required-title" className={styles.title}>Укажите дату рождения</p>
        <p className={styles.message}>
          Чтобы фильтровать мероприятия 18+, укажите дату рождения.
        </p>
        <div className={styles.field}>
          <DatePicker
            value={birthDate}
            onChange={setBirthDate}
            placeholder="дд.мм.гггг"
            min="1900-01-01"
            max={todayLocalDateString()}
            autoComplete="bday"
            name="bday"
          />
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={busy}>
            Отмена
          </button>
          <button
            type="button"
            className={styles.saveBtn}
            disabled={!canSave}
            onClick={() => { void onSave(birthDate); }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
