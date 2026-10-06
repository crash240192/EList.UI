import styles from './OppositeGenderDialog.module.css';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';

interface OppositeGenderDialogProps {
  onParticipate: () => void;
  onDecline: () => void;
}

export function OppositeGenderDialog({ onParticipate, onDecline }: OppositeGenderDialogProps) {
  useModalBackButton(onDecline);

  return (
    <>
      <div className={styles.backdrop} onClick={onDecline} aria-hidden />
      <div
        className={styles.modal}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="opposite-gender-text"
      >
        <p id="opposite-gender-text" className={styles.text}>
          Данное мероприятие предназначено для противоположного пола. Вы действительно хотите принять участие?
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.participate} onClick={onParticipate}>
            Участвовать
          </button>
          <button type="button" className={`${styles.decline} noHoverGlow`} onClick={onDecline}>
            Отказаться
          </button>
        </div>
      </div>
    </>
  );
}
