import pinUrl from './event-pin.png';
import styles from './PinnedCoverBadge.module.css';

export function PinnedCoverBadge({ placement = 'inline' }: { placement?: 'inline' | 'corner' }) {
  return (
    <span
      className={`${styles.badge} ${placement === 'corner' ? styles.corner : ''}`}
      role="img"
      aria-label="Закреплено"
    >
      <img src={pinUrl} alt="" className={styles.glyph} width={14} height={14} />
    </span>
  );
}

export function PinMenuGlyph() {
  return <img src={pinUrl} alt="" className={styles.menuGlyph} width={14} height={14} />;
}

/** Значок «я организатор»: тот же круг, что у закрепа, со сдвигом в ряду бейджей. */
export function OrganizerCoverBadge() {
  return (
    <span className={styles.badge} role="img" aria-label="Организатор">
      <svg className={styles.organizerGlyph} viewBox="0 0 24 24" width="14" height="14" aria-hidden>
        <circle cx="12" cy="7.6" r="3.15" />
        <path d="M5.15 19.35c.42-3.25 3.05-5.05 6.85-5.05s6.43 1.8 6.85 5.05c.1.58-.36 1.15-.96 1.15H6.11c-.6 0-1.06-.57-.96-1.15z" />
      </svg>
    </span>
  );
}
