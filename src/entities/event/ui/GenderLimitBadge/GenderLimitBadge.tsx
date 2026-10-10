import type { Gender } from '@/shared/api/types';
import styles from './GenderLimitBadge.module.css';

interface GenderLimitBadgeProps {
  gender: Gender | null | undefined;
}

export function GenderLimitBadge({ gender }: GenderLimitBadgeProps) {
  if (gender !== 'Female' && gender !== 'Male') return null;
  const label = gender === 'Male' ? 'Только мужчины' : 'Только женщины';

  return (
    <span className={`${styles.badge} ${gender === 'Female' ? styles.female : styles.male}`}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
      {label}
    </span>
  );
}
