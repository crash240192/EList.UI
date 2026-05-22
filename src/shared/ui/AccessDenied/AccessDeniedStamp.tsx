import styles from './AccessDeniedStamp.module.css';

export type AccessDeniedStampSize = 'sm' | 'md' | 'lg';

interface AccessDeniedStampProps {
  size?: AccessDeniedStampSize;
  className?: string;
}

export function AccessDeniedStamp({ size = 'md', className }: AccessDeniedStampProps) {
  const sizeClass = size === 'sm' ? styles.stamp_sm : size === 'lg' ? styles.stamp_lg : styles.stamp_md;

  return (
    <div
      className={`${styles.stamp} ${sizeClass} ${className ?? ''}`}
      role="img"
      aria-label="Доступ запрещён"
    >
      <svg className={styles.icon} viewBox="0 0 48 48" fill="none" aria-hidden>
        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="3.5" />
        <rect x="10" y="21" width="28" height="6" rx="1" fill="currentColor" />
      </svg>
      <div className={styles.text}>
        <span className={styles.line}>ACCESS</span>
        <span className={styles.line}>DENIED</span>
      </div>
    </div>
  );
}
