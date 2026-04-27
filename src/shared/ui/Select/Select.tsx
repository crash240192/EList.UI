// shared/ui/Select/Select.tsx

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Select({ value, onChange, options, placeholder = 'Выберите...', className, disabled }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  const computePos = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const dropH = Math.min(options.length * 38 + 8, 260);
    const showAbove = spaceBelow < dropH && r.top > spaceBelow;
    setDropStyle({
      position: 'fixed',
      left: r.left,
      width: r.width,
      zIndex: 9999,
      ...(showAbove
        ? { bottom: window.innerHeight - r.top + 4 }
        : { top: r.bottom + 4 }),
    });
  }, [options.length]);

  useEffect(() => {
    if (!open) return;
    computePos();
    const close = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node) &&
          !dropRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open, computePos]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div className={`${styles.wrap} ${className ?? ''}`}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        className={`${styles.btn} ${open ? styles.btnOpen : ''}`}
        onClick={() => !disabled && setOpen(v => !v)}>
        <span className={selected ? styles.value : styles.placeholder}>
          {selected ? selected.label : placeholder}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`${styles.arrow} ${open ? styles.arrowOpen : ''}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && createPortal(
        <div ref={dropRef} style={dropStyle} className={styles.dropdown}>
          {placeholder && !value && (
            <div className={`${styles.item} ${styles.itemPlaceholder}`} onClick={() => handleSelect('')}>
              {placeholder}
            </div>
          )}
          {options.map(opt => (
            <div key={opt.value}
              className={`${styles.item} ${opt.value === value ? styles.itemActive : ''}`}
              onClick={() => handleSelect(opt.value)}>
              {opt.label}
              {opt.value === value && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
