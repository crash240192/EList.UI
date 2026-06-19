import {
  formatTextLengthCount,
  getTextLengthHintTone,
} from '@/shared/lib/clampText';
import styles from './TextLengthHint.module.css';

interface TextLengthHintProps {
  length: number;
  maxLength: number;
  className?: string;
}

export function TextLengthHint({ length, maxLength, className }: TextLengthHintProps) {
  const tone = getTextLengthHintTone(length, maxLength);
  if (!tone) return null;

  const count = formatTextLengthCount(length, maxLength);

  return (
    <span
      className={`${styles.hint} ${tone === 'max' ? styles.hintMax : styles.hintNear} ${className ?? ''}`}
      aria-live="polite"
    >
      {tone === 'max' ? (
        <>
          <span className={styles.label}>Достигнут максимальный размер</span>
          <span className={styles.count}>{count}</span>
        </>
      ) : (
        <span className={styles.count}>{count}</span>
      )}
    </span>
  );
}
