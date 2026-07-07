import { useRef } from 'react';
import styles from './OtpCodeInput.module.css';

const DEFAULT_LENGTH = 6;

interface OtpCodeInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  onSubmit?: () => void;
}

export function OtpCodeInput({
  length = DEFAULT_LENGTH,
  value,
  onChange,
  error = false,
  disabled = false,
  autoFocus = true,
  className,
  onSubmit,
}: OtpCodeInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const updateDigits = (nextDigits: string[]) => {
    onChange(nextDigits.join('').slice(0, length));
  };

  const handleDigit = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = clean;
    updateDigits(next);
    if (clean && index < length - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter' && value.length === length) onSubmit?.();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    const next = Array.from({ length }, (_, i) => pasted[i] ?? '');
    updateDigits(next);
    inputRefs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div
      className={`${styles.row} ${className ?? ''}`}
      onPaste={handlePaste}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={el => { inputRefs.current[index] = el; }}
          className={`${styles.input} ${error ? styles.error : ''} ${digit ? styles.filled : ''}`}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          autoFocus={autoFocus && index === 0}
          disabled={disabled}
          aria-label={`Цифра ${index + 1}`}
          onChange={e => handleDigit(index, e.target.value)}
          onKeyDown={e => handleKeyDown(index, e)}
        />
      ))}
    </div>
  );
}
