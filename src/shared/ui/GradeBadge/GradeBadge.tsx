// shared/ui/GradeBadge/GradeBadge.tsx

import {
  getEventRatingGrade,
  getEventRatingSimpleGrade,
} from '@/shared/lib/eventRatingGrade';
import styles from './GradeBadge.module.css';

const ROUGH_CIRCLE =
  'M24,6 C34,2 41,12 38,22 C36,33 26,38 14,36 C3,34 -1,26 2,17 C5,8 14,4 23,5 C28,5 34,8 31,14';

interface GradeBadgeProps {
  score: number;
  size?: 'xs' | 'sm' | 'lg';
  /** true — целая оценка 1–5 (A/B/C/D/F), false — средний рейтинг */
  simple?: boolean;
}

export function GradeBadge({ score, size = 'sm', simple = false }: GradeBadgeProps) {
  const { label, color, rot } = simple
    ? getEventRatingSimpleGrade(score)
    : getEventRatingGrade(score);
  const long = label.length > 1;

  return (
    <span
      className={`${styles.gb} ${styles[`gb_${size}`]}`}
      style={{ color, transform: `rotate(${rot}deg)` }}
      aria-label={label}
    >
      <svg viewBox="0 0 40 40" fill="none" className={styles.gbRing} aria-hidden>
        <path d={ROUGH_CIRCLE} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span className={`${styles.gbLabel} ${long ? styles.gbLabelLong : ''}`}>{label}</span>
    </span>
  );
}
