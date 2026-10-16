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
