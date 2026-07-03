// shared/ui/ContactMaskField/ContactMaskField.tsx

import { useLayoutEffect, useRef } from 'react';
import {
  buildContactDisplayValue,
  buildContactMaskSegments,
  extractRawFromValue,
  getContactCaretIndex,
  processEmailRaw,
  processPhoneRaw,
  resolveContactMaskTemplate,
  type MaskSegment,
} from '@/shared/lib/contactMaskFormat';
import styles from './ContactMaskField.module.css';

const SEG_CLASS: Record<MaskSegment['type'], string> = {
  filled: styles.filled,
  ghost:  styles.ghost,
  sep:    styles.sep,
};

interface ContactMaskFieldProps {
  mask: string | null;
  typeName?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  ariaLabel?: string;
  className?: string;
}

function hasTextSelection(input: HTMLInputElement): boolean {
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;
  return start !== end;
}

function MaskVisual({ segments }: { segments: MaskSegment[] }) {
  return (
    <div className={styles.visual} aria-hidden="true">
      {segments.map((seg, i) => (
        <span key={i} className={SEG_CLASS[seg.type]}>{seg.text}</span>
      ))}
    </div>
  );
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
  const inputRef = useRef<HTMLInputElement>(null);
  const caretIndexRef = useRef<number | null>(null);

  const isPhone = Boolean(template?.includes('#'));
  const raw = template ? extractRawFromValue(template, value) : value;
  const displayValue = template ? buildContactDisplayValue(template, raw) : value;
  const segments = template ? buildContactMaskSegments(template, raw) : [];

  useLayoutEffect(() => {
    const input = inputRef.current;
    const pos = caretIndexRef.current;
    if (!input || pos === null) return;
    input.setSelectionRange(pos, pos);
    caretIndexRef.current = null;
  }, [displayValue]);

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

  const scheduleCaret = (nextRaw: string) => {
    caretIndexRef.current = getContactCaretIndex(template, nextRaw);
  };

  const applyRaw = (nextRaw: string) => {
    const processed = isPhone
      ? processPhoneRaw(template, nextRaw)
      : processEmailRaw(template, nextRaw);
    scheduleCaret(processed);
    onChange(processed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const mod = e.ctrlKey || e.metaKey;
    const selected = hasTextSelection(input);

    if (mod && e.key.toLowerCase() === 'a') return;

    if (mod && e.key === 'Backspace') {
      e.preventDefault();
      applyRaw('');
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      if (selected) {
        applyRaw('');
      } else {
        applyRaw(raw.slice(0, -1));
      }
      return;
    }

    if (e.key.length !== 1 || mod || e.altKey) return;

    if (isPhone) {
      if (/\d/.test(e.key)) {
        e.preventDefault();
        applyRaw(selected ? e.key : raw + e.key);
      } else {
        e.preventDefault();
      }
      return;
    }

    if (/[a-zA-Z0-9@._+-]/.test(e.key)) {
      e.preventDefault();
      applyRaw(selected ? e.key : raw + e.key);
    } else {
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    if (!pasted) return;

    if (isPhone) {
      const digits = pasted.replace(/\D/g, '');
      if (digits) applyRaw(digits);
      return;
    }

    const cleaned = pasted.replace(/[^a-zA-Z0-9@._+-]/g, '');
    if (cleaned) applyRaw(cleaned);
  };

  const handleFocus = () => {
    const input = inputRef.current;
    if (!input) return;
    const pos = getContactCaretIndex(template, raw);
    input.setSelectionRange(pos, pos);
  };

  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <MaskVisual segments={segments} />
      <input
        ref={inputRef}
        type="text"
        inputMode={isPhone ? 'tel' : 'email'}
        autoComplete="off"
        className={styles.input}
        value={displayValue}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={handleFocus}
        onChange={() => {}}
        onBlur={onBlur}
        aria-label={ariaLabel}
      />
    </div>
  );
}
