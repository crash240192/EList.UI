// shared/ui/ContactMaskField/ContactMaskField.tsx

import { useRef, useState } from 'react';
import {
  buildContactMaskSegments,
  extractRawFromValue,
  processEmailRaw,
  processPhoneRaw,
  resolveContactMaskTemplate,
  type MaskSegment,
} from '@/shared/lib/contactMaskFormat';
import styles from '@/shared/ui/DatePicker/DatePicker.module.css';

const SEG_CLASS: Record<MaskSegment['type'], string> = {
  filled: styles.maskFilled,
  ghost:  styles.maskGhost,
  sep:    styles.maskSep,
};

function MaskVisual({ segments, focused }: { segments: MaskSegment[]; focused?: boolean }) {
  let caretPlaced = false;
  return (
    <div className={styles.maskVisual} aria-hidden="true">
      {segments.map((seg, i) => {
        const placeCaret = Boolean(focused) && !caretPlaced && seg.type === 'ghost';
        if (placeCaret) caretPlaced = true;
        return (
          <span key={i}>
            {placeCaret && <span className={styles.maskCaret} />}
            <span className={SEG_CLASS[seg.type]}>{seg.text}</span>
          </span>
        );
      })}
      {focused && !caretPlaced && <span className={styles.maskCaret} />}
    </div>
  );
}

interface ContactMaskFieldProps {
  mask: string | null;
  typeName?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  ariaLabel?: string;
  className?: string;
}

export function ContactMaskField({
  mask,
  typeName = '',
  value,
  onChange,
  onBlur,
  ariaLabel,
  className,
}: ContactMaskFieldProps) {
  const template = resolveContactMaskTemplate(mask, typeName);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!template) {
    return (
      <input
        ref={inputRef}
        type="text"
        className={className}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        aria-label={ariaLabel}
        autoComplete="off"
      />
    );
  }

  const isPhone = template.includes('#');
  const raw = extractRawFromValue(template, value);
  const segments = buildContactMaskSegments(template, raw);

  const applyRaw = (nextRaw: string) => {
    const processed = isPhone
      ? processPhoneRaw(template, nextRaw)
      : processEmailRaw(template, nextRaw);
    onChange(processed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      applyRaw(raw.slice(0, -1));
      return;
    }
    if (e.key.length === 1) {
      if (isPhone && /\d/.test(e.key)) {
        e.preventDefault();
        applyRaw(raw + e.key);
      } else if (!isPhone && /[a-zA-Z0-9@._+-]/.test(e.key)) {
        e.preventDefault();
        applyRaw(raw + e.key);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pasted = e.target.value;
    e.target.value = '';
    applyRaw(isPhone ? pasted.replace(/\D/g, '') : pasted);
  };

  return (
    <div className={`${styles.maskField} ${className ?? ''}`} style={{ width: '100%' }}>
      <MaskVisual segments={segments} focused={focused} />
      <input
        ref={inputRef}
        type="text"
        inputMode={isPhone ? 'tel' : 'email'}
        autoComplete="off"
        className={styles.maskCapture}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); onBlur?.(); }}
        aria-label={ariaLabel}
      />
    </div>
  );
}
