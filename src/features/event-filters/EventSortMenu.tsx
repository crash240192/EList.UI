import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  EVENT_LIST_SORT_OPTIONS,
  type EventListSortId,
} from './eventListSort';
import styles from './EventSortMenu.module.css';

interface EventSortMenuProps {
  value: EventListSortId;
  onChange: (next: EventListSortId) => void;
  /** Круглая кнопка-иконка (мобилка / рядом с поиском). */
  className?: string;
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 6h10" />
      <path d="M4 12h7" />
      <path d="M4 18h4" />
      <path d="M17 8l3-3 3 3" />
      <path d="M20 5v14" />
    </svg>
  );
}

export function EventSortMenu({ value, onChange, className }: EventSortMenuProps) {
  const [open, setOpen] = useState(false);
  const [dropStyle, setDropStyle] = useState<CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const isDefault = value === 'startAsc';

  const close = useCallback(() => setOpen(false), []);

  const computePos = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const estimatedHeight = 360;
    const spaceBelow = window.innerHeight - rect.bottom;
    const showAbove = spaceBelow < estimatedHeight && rect.top > spaceBelow;
    setDropStyle({
      position: 'fixed',
      right: Math.max(8, window.innerWidth - rect.right),
      zIndex: 600,
      ...(showAbove
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    let last = '';
    const follow = () => {
      const el = btnRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const key = [
          Math.round(rect.left),
          Math.round(rect.top),
          Math.round(rect.right),
          Math.round(rect.bottom),
          window.innerWidth,
          window.innerHeight,
        ].join('|');
        if (key !== last) {
          last = key;
          computePos();
        }
      }
      frame = requestAnimationFrame(follow);
    };
    follow();

    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (btnRef.current?.contains(target) || dropRef.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, computePos, close]);

  return (
    <div className={`${styles.wrap} ${className ?? ''}`}>
      <button
        ref={btnRef}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''} noHoverGlow`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Сортировка"
        title="Сортировка"
        onClick={() => setOpen(current => !current)}
      >
        <SortIcon />
        {!isDefault && <span className={styles.triggerDot} aria-hidden />}
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          className={styles.menu}
          style={dropStyle}
          role="dialog"
          aria-label="Сортировка мероприятий"
        >
          <div className={styles.sectionLabel}>Сортировка</div>
          <div className={styles.options} role="radiogroup" aria-label="Порядок списка">
            {EVENT_LIST_SORT_OPTIONS.map(option => {
              const selected = value === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`${styles.option} ${selected ? styles.optionOn : ''}`}
                  onClick={() => {
                    onChange(option.id);
                    close();
                  }}
                >
                  <span className={styles.box}>{selected && <CheckIcon />}</span>
                  <span className={styles.optionText}>
                    <span>{option.label}</span>
                    {option.hint && <span className={styles.optionHint}>{option.hint}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
