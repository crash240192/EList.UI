// shared/ui/Toast/Toast.tsx

import { useToastStore } from '@/app/store';
import styles from './Toast.module.css';

function ErrorIcon() {
  return (
    <svg className={styles.icon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg className={styles.icon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className={styles.icon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  );
}

const ICONS = { error: <ErrorIcon />, success: <SuccessIcon />, info: <InfoIcon /> };

export function ToastContainer() {
  const { toasts, remove } = useToastStore();
  if (toasts.length === 0) return null;
  return (
    <div className={styles.container}>
      {toasts.map(t => (
        <div key={t.id} className={`${styles.toast} ${styles[t.type]}`}>
          {ICONS[t.type]}
          <span className={styles.msg}>{t.message}</span>
          <button className={styles.close} onClick={() => remove(t.id)} aria-label="Закрыть">×</button>
        </div>
      ))}
    </div>
  );
}
