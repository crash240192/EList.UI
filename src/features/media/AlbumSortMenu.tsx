import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  ALBUM_LIST_SORT_OPTIONS,
  type AlbumListSort,
} from '@/features/media/albumListSort';
import styles from './AlbumSortMenu.module.css';

interface AlbumSortMenuProps {
  value: AlbumListSort;
  onChange: (next: AlbumListSort) => void;
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function AlbumSortMenu({ value, onChange }: AlbumSortMenuProps) {
  const [open, setOpen] = useState(false);
  const [dropStyle, setDropStyle] = useState<CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const computePos = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const estimatedHeight = 176;
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
    <div className={styles.wrap}>
      <button
        ref={btnRef}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''} noHoverGlow`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(current => !current)}
      >
        Сортировка
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          className={styles.menu}
          style={dropStyle}
          role="dialog"
          aria-label="Сортировка"
        >
          <div className={styles.options} role="radiogroup" aria-label="Порядок плиток">
            {ALBUM_LIST_SORT_OPTIONS.map(option => {
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
                  {option.label}
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
