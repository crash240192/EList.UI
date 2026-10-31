// shared/ui/ContactMaskField/ContactMaskField.tsx
//
// phone_ru → визуальная маска; email/text → обычный input (без overlay).
// Рамка поля всегда в .shell — иначе на iOS «голый» input рисует белый прямоугольник.

import { useLayoutEffect, useRef } from 'react';
import {
  buildContactDisplayValue,
  buildContactMaskSegments,
  extractRawFromValue,
  getContactCaretIndex,
  getMaskInputMode,
  processPhoneRaw,
  resolveContactInputKind,
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
  placeholder?: string;
  /** Подсветка ошибки на рамке */
  error?: boolean;
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
  placeholder,
  error = false,
  className,
}: ContactMaskFieldProps) {
  const kind = resolveContactInputKind(mask, typeName);
  const template = resolveContactMaskTemplate(mask, typeName);
  const inputRef = useRef<HTMLInputElement>(null);
  const caretIndexRef = useRef<number | null>(null);

  const isPhone = kind === 'phone_ru' && Boolean(template);
  const raw = template ? extractRawFromValue(template, value) : value;
  const displayValue = template ? buildContactDisplayValue(template, raw) : value;
  const segments = template ? buildContactMaskSegments(template, raw) : [];
  const inputMode = getMaskInputMode(mask, typeName);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const pos = caretIndexRef.current;
    if (!input || pos === null || !isPhone) return;
    input.setSelectionRange(pos, pos);
    caretIndexRef.current = null;
  }, [displayValue, isPhone]);

  const shellClass = [
    styles.shell,
    error ? styles.shellError : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  // email / text — обычный контролируемый input внутри общей рамки
  if (!isPhone || !template) {
    return (
      <div className={shellClass}>
        <input
          ref={inputRef}
          type="text"
          inputMode={inputMode}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={styles.plainInput}
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          aria-label={ariaLabel ?? placeholder}
          autoComplete={kind === 'email' ? 'email' : 'off'}
        />
      </div>
    );
  }

  const scheduleCaret = (nextRaw: string) => {
    caretIndexRef.current = getContactCaretIndex(template, nextRaw);
  };

  const applyRaw = (nextRaw: string) => {
    const processed = processPhoneRaw(template, nextRaw);
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
      applyRaw(selected ? '' : raw.slice(0, -1));
      return;
    }

    if (e.key.length !== 1 || mod || e.altKey) return;

    if (/\d/.test(e.key)) {
      e.preventDefault();
      applyRaw(selected ? e.key : raw + e.key);
    } else {
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '');
    if (digits) applyRaw(digits);
  };

  const handleFocus = () => {
    const input = inputRef.current;
    if (!input) return;
    const pos = getContactCaretIndex(template, raw);
    input.setSelectionRange(pos, pos);
  };

  return (
    <div className={shellClass}>
      <div className={styles.maskField}>
        <MaskVisual segments={segments} />
        <input
          ref={inputRef}
          type="text"
          inputMode="tel"
          autoComplete="tel"
          className={styles.maskInput}
          value={displayValue}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={handleFocus}
          onChange={() => {}}
          onBlur={onBlur}
          aria-label={ariaLabel ?? placeholder}
        />
      </div>
    </div>
  );
}
