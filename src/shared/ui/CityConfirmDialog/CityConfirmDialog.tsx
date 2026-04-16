// shared/ui/CityConfirmDialog/CityConfirmDialog.tsx

import styles from './CityConfirmDialog.module.css';

interface Props {
  cityName: string;
  onConfirm: () => void;
  onKeep: () => void;
}

export function CityConfirmDialog({ cityName, onConfirm, onKeep }: Props) {
  return (
    <>
      <div className={styles.backdrop} />
      <div className={styles.dialog} role="dialog" aria-modal>
        <div className={styles.icon}>📍</div>
        <h3 className={styles.title}>Вы сменили город?</h3>
        <p className={styles.text}>
          Похоже, вы сейчас находитесь в другом городе:<br />
          <strong>{cityName}</strong>
        </p>
        <p className={styles.sub}>Обновить ваше местоположение?</p>
        <div className={styles.actions}>
          <button className={styles.keepBtn} onClick={onKeep}>Нет, оставить</button>
          <button className={styles.confirmBtn} onClick={onConfirm}>Да, обновить</button>
        </div>
      </div>
    </>
  );
}
