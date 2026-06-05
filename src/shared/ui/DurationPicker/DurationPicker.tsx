// shared/ui/DurationPicker/DurationPicker.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  sanitizeTimeDigits,
  timeDigitsToHM,
  hmToTimeDigits,
} from '@/shared/lib/dateTimeMask';
import { TimeMaskField } from '@/shared/ui/DatePicker/MaskField';
import fieldStyles from '@/shared/ui/DatePicker/DatePicker.module.css';
import styles from './DurationPicker.module.css';

const HOURS_LIST   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES_LIST = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

function toDigits(hours: number, minutes: number): string {
  // 0:0 — «не задано», показываем пустую маску __:__
  if (hours === 0 && minutes === 0) return '';
  return hmToTimeDigits(
    String(hours).padStart(2, '0'),
    String(Math.round(minutes / 5) * 5).padStart(2, '0'),
  );
}

function DurationWheel({ items, selected, onSelect }: {
  items: string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  const ITEM_H  = 36;
  const VISIBLE = 5;
  const listRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(() => Math.max(0, items.indexOf(selected)));

  useEffect(() => {
    const i = Math.max(0, items.indexOf(selected));
    setIdx(i);
    if (listRef.current) listRef.current.scrollTop = i * ITEM_H;
  }, [selected, items]);

  const scrollToIdx = (i: number) => {
    const clamped = Math.max(0, Math.min(items.length - 1, i));
    setIdx(clamped);
    onSelect(items[clamped]);
    listRef.current?.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' });
  };

  const handleScroll = () => {
    if (!listRef.current) return;
    const i = Math.round(listRef.current.scrollTop / ITEM_H);
    const clamped = Math.min(i, items.length - 1);
    if (clamped !== idx) { setIdx(clamped); onSelect(items[clamped]); }
  };

  return (
    <div className={styles.wheelWrap} style={{ height: ITEM_H * VISIBLE }}>
      <div className={styles.wheelHighlight} style={{ top: ITEM_H * Math.floor(VISIBLE / 2) }} />
      <div ref={listRef} className={styles.wheelList} onScroll={handleScroll}
        style={{ height: ITEM_H * VISIBLE }}>
        <div style={{ height: ITEM_H * Math.floor(VISIBLE / 2) }} />
        {items.map((v, i) => (
          <div key={v} className={`${styles.wheelItem} ${i === idx ? styles.wheelItemActive : ''}`}
            onClick={() => scrollToIdx(i)}>{v}</div>
        ))}
        <div style={{ height: ITEM_H * Math.floor(VISIBLE / 2) }} />
      </div>
    </div>
  );
}

interface DurationPickerProps {
  hours: number;
  minutes: number;
  onChangeHours: (h: number) => void;
  onChangeMinutes: (m: number) => void;
  className?: string;
  hasError?: boolean;
}

export function DurationPicker({ hours, minutes, onChangeHours, onChangeMinutes, className, hasError }: DurationPickerProps) {
  const [open, setOpen] = useState(false);
  const [timeDigits, setTimeDigits] = useState(() => toDigits(hours, minutes));
  const [draftH, setDraftH] = useState(hours);
  const [draftM, setDraftM] = useState(Math.round(minutes / 5) * 5);

  useEffect(() => {
    setTimeDigits(toDigits(hours, minutes));
  }, [hours, minutes]);

  const applyHM = useCallback((h: number, m: number) => {
    onChangeHours(h);
    onChangeMinutes(m);
    setTimeDigits(toDigits(h, m));
  }, [onChangeHours, onChangeMinutes]);

  const commitDigits = useCallback((digits: string): boolean => {
    if (!digits) {
      applyHM(0, 0);
      return true;
    }
    const hm = timeDigitsToHM(digits);
    if (!hm) return false;
    applyHM(parseInt(hm.h, 10), parseInt(hm.m, 10));
    return true;
  }, [applyHM]);

  const handleDigitsChange = (digits: string) => {
    setTimeDigits(digits);
    if (digits.length === 0) {
      onChangeHours(0);
      onChangeMinutes(0);
      return;
    }
    if (digits.length === 4) commitDigits(digits);
  };

  const handleDigitsBlur = () => {
    if (!timeDigits) {
      applyHM(0, 0);
      return;
    }
    if (timeDigits.length === 4) {
      if (!commitDigits(timeDigits)) setTimeDigits(toDigits(hours, minutes));
    } else {
      setTimeDigits(toDigits(hours, minutes));
    }
  };

  const handleOpen = () => {
    setDraftH(hours);
    setDraftM(Math.round(minutes / 5) * 5);
    setOpen(true);
  };

  const handleConfirm = () => {
    applyHM(draftH, draftM);
    setOpen(false);
  };

  const handleClear = () => {
    onChangeHours(0);
    onChangeMinutes(0);
    setTimeDigits('');
  };

  const hasValue = hours > 0 || minutes > 0;

  return (
    <>
      <div className={`${fieldStyles.field} ${open ? fieldStyles.fieldOpen : ''} ${hasError ? fieldStyles.fieldError : ''} ${className ?? ''}`}>
        <TimeMaskField
          digits={timeDigits}
          onDigitsChange={handleDigitsChange}
          onBlur={handleDigitsBlur}
          processRaw={sanitizeTimeDigits}
          ariaLabel="чч:мм"
        />
        {hasValue && (
          <button type="button" className={fieldStyles.clearBtn} aria-label="Очистить"
            onClick={handleClear}>×</button>
        )}
        <button type="button" className={fieldStyles.calendarBtn} aria-label="Открыть выбор длительности"
          onClick={() => setOpen(v => !v)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={fieldStyles.icon}>
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </button>
      </div>

      {open && createPortal(
        <>
          <div className={styles.modalBackdrop} onClick={() => setOpen(false)} />
          <div className={styles.modal}>
            <div className={styles.modalTitle}>Длительность</div>
            <div className={styles.wheelLabels}>
              <div className={styles.wheelLabel}>Ч</div>
              <div className={styles.wheelLabelGap} />
              <div className={styles.wheelLabel}>М</div>
            </div>
            <div className={styles.wheelsRow}>
              <DurationWheel items={HOURS_LIST} selected={String(draftH).padStart(2, '0')}
                onSelect={v => setDraftH(parseInt(v, 10))} />
              <span className={styles.wheelSep}>:</span>
              <DurationWheel items={MINUTES_LIST} selected={String(draftM).padStart(2, '0')}
                onSelect={v => setDraftM(parseInt(v, 10))} />
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.modalCancel} onClick={() => setOpen(false)}>Отмена</button>
              <button type="button" className={styles.modalOk} onClick={handleConfirm}>Выбрать</button>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
