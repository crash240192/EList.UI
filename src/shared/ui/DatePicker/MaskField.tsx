// shared/ui/DatePicker/MaskField.tsx

import { useRef, useState } from 'react';
import {
  buildDateTimeMaskSegments,
  buildTimeMaskSegments,
  type MaskSegment,
} from '@/shared/lib/dateTimeMask';
import styles from './DatePicker.module.css';

const SEG_CLASS: Record<MaskSegment['type'], string> = {
  filled: styles.maskFilled,
  ghost:  styles.maskGhost,
  sep:    styles.maskSep,
};

function MaskVisual({ segments }: { segments: MaskSegment[] }) {
  return (
    <div className={styles.maskVisual} aria-hidden="true">
      {segments.map((seg, i) => (
        <span key={i} className={SEG_CLASS[seg.type]}>{seg.text}</span>
      ))}
    </div>
  );
}

function MaskCapture({
  digits,
  onDigitsChange,
  onBlur,
  onFocus,
  ariaLabel,
  processRaw,
}: {
  digits: string;
  onDigitsChange: (digits: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  ariaLabel?: string;
  processRaw: (raw: string) => string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      onDigitsChange(processRaw(digits + e.key));
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      onDigitsChange(digits.slice(0, -1));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    e.target.value = '';
    onDigitsChange(processRaw(raw));
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={styles.maskCapture}
      onKeyDown={handleKeyDown}
      onChange={handleChange}
      onFocus={onFocus}
      onBlur={onBlur}
      aria-label={ariaLabel}
    />
  );
}

interface MaskFieldBaseProps {
  digits: string;
  onDigitsChange: (digits: string) => void;
  onBlur?: () => void;
  emptyLabel?: string;
  ariaLabel?: string;
  className?: string;
}

/** Поле дд.мм.гггг [ чч:мм] с фиксированными разделителями */
export function DateTimeMaskField({
  digits,
  onDigitsChange,
  withTime,
  onBlur,
  emptyLabel,
  ariaLabel,
  className,
  processRaw,
}: MaskFieldBaseProps & {
  withTime: boolean;
  processRaw: (raw: string) => string;
}) {
  const [focused, setFocused] = useState(false);
  const showEmptyLabel = Boolean(emptyLabel) && !focused && digits.length === 0;

  return (
    <div className={`${styles.maskField} ${className ?? ''}`}>
      {showEmptyLabel
        ? <span className={styles.maskEmptyLabel}>{emptyLabel}</span>
        : <MaskVisual segments={buildDateTimeMaskSegments(digits, withTime)} />
      }
      <MaskCapture
        digits={digits}
        ariaLabel={ariaLabel}
        processRaw={processRaw}
        onDigitsChange={onDigitsChange}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); onBlur?.(); }}
      />
    </div>
  );
}

/** Поле чч:мм с фиксированным двоеточием */
export function TimeMaskField({
  digits,
  onDigitsChange,
  onBlur,
  ariaLabel,
  className,
  processRaw,
}: MaskFieldBaseProps & {
  processRaw: (raw: string) => string;
}) {
  return (
    <div className={`${styles.maskField} ${styles.maskFieldTime} ${className ?? ''}`}>
      <MaskVisual segments={buildTimeMaskSegments(digits)} />
      <MaskCapture
        digits={digits}
        ariaLabel={ariaLabel}
        processRaw={processRaw}
        onDigitsChange={onDigitsChange}
        onBlur={onBlur}
      />
    </div>
  );
}
