// shared/ui/DatePicker/DatePicker.tsx
// Кастомный выбор даты (и опционально времени) в стилистике EList

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './DatePicker.module.css';

interface DatePickerProps {
  /** Значение в формате ISO или YYYY-MM-DD */
  value: string;
  onChange: (iso: string) => void;
  /** Показывать выбор времени */
  withTime?: boolean;
  /** Только дата, без времени (если withTime=false) */
  placeholder?: string;
  label?: string;
  min?: string; // YYYY-MM-DD
  max?: string; // YYYY-MM-DD
  className?: string;
  hasError?: boolean;
}

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                 'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

function parseValue(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatDisplay(date: Date, withTime: boolean): string {
  const day   = date.getDate();
  const month = MONTHS[date.getMonth()];
  const year  = date.getFullYear();
  if (!withTime) return `${day} ${month} ${year}`;
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hh}:${mm}`;
}

function toISO(date: Date, withTime: boolean): string {
  if (!withTime) return date.toISOString().slice(0, 10);
  return date.toISOString();
}

export function DatePicker({ value, onChange, withTime = false, placeholder, min, max, className, hasError }: DatePickerProps) {
  const [open, setOpen]     = useState(false);
  const wrapRef             = useRef<HTMLDivElement>(null);
  const fieldRef            = useRef<HTMLButtonElement>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});

  const parsed = parseValue(value);
  const [viewYear,  setViewYear]  = useState(() => parsed?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parsed?.getMonth()    ?? new Date().getMonth());
  const [selDate,   setSelDate]   = useState<Date | null>(parsed);
  const [timeH,     setTimeH]     = useState(() => parsed?.getHours()   ?? 0);
  const [timeM,     setTimeM]     = useState(() => parsed?.getMinutes() ?? 0);

  // Синхронизируем если value изменился снаружи
  useEffect(() => {
    const d = parseValue(value);
    setSelDate(d);
    if (d) { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); setTimeH(d.getHours()); setTimeM(d.getMinutes()); }
  }, [value]);

  // Закрытие по клику вне
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current && !wrapRef.current.contains(target)) {
        // Также проверяем portal-popup через data-атрибут
        const popup = document.querySelector('[data-datepicker-popup]');
        if (!popup || !popup.contains(target)) setOpen(false);
      }
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', fn);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fn); document.removeEventListener('keydown', esc); };
  }, []);

  // Вычисляем позицию popup при открытии
  useEffect(() => {
    if (!open || !fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const popupH = withTime ? 420 : 360; // приблизительная высота
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const showAbove = spaceBelow < popupH && spaceAbove > spaceBelow;

    setPopupStyle({
      position: 'fixed',
      left: Math.min(rect.left, window.innerWidth - 288 - 8),
      top:  showAbove ? rect.top - popupH - 6 : rect.bottom + 6,
      width: 280,
      zIndex: 9999,
    });
  }, [open, withTime]);

  const handleSelect = useCallback((day: number) => {
    const d = new Date(viewYear, viewMonth, day, timeH, timeM, 0, 0);
    setSelDate(d);
    if (!withTime) { onChange(toISO(d, false)); setOpen(false); }
  }, [viewYear, viewMonth, timeH, timeM, withTime, onChange]);

  const handleConfirm = () => {
    if (!selDate) return;
    const d = new Date(selDate.getFullYear(), selDate.getMonth(), selDate.getDate(), timeH, timeM, 0, 0);
    onChange(toISO(d, withTime));
    setOpen(false);
  };

  const handleClear = () => { onChange(''); setSelDate(null); setOpen(false); };

  // Строим сетку дней
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=вс
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev  = new Date(viewYear, viewMonth, 0).getDate();
  // Понедельник = 0, смещаем
  const startOffset = (firstDay === 0 ? 6 : firstDay - 1);

  const cells: { day: number; month: 'prev' | 'cur' | 'next' }[] = [];
  for (let i = startOffset - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, month: 'prev' });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, month: 'cur' });
  let next = 1;
  while (cells.length % 7 !== 0) cells.push({ day: next++, month: 'next' });

  const today = new Date();
  const isToday  = (d: number) => d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
  const isSelected = (d: number) => selDate
    ? d === selDate.getDate() && viewMonth === selDate.getMonth() && viewYear === selDate.getFullYear()
    : false;

  const isDisabled = (d: number) => {
    const dt = new Date(viewYear, viewMonth, d);
    if (min && dt < new Date(min)) return true;
    if (max && dt > new Date(max + 'T23:59:59')) return true;
    return false;
  };

  // Быстрый выбор года
  const currentYear = new Date().getFullYear();
  const minYear = min ? parseInt(min.slice(0, 4)) : 1900;
  const maxYear = max ? parseInt(max.slice(0, 4)) : currentYear;
  const yearRange: number[] = [];
  for (let y = Math.max(minYear, viewYear - 4); y <= Math.min(maxYear, viewYear + 4); y++) yearRange.push(y);

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  return (
    <div ref={wrapRef} className={`${styles.wrap} ${className ?? ''}`}>
      {/* Поле ввода */}
      <button
        ref={fieldRef}
        type="button"
        className={`${styles.field} ${open ? styles.fieldOpen : ''} ${hasError ? styles.fieldError : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.icon}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span className={selDate ? styles.fieldValue : styles.fieldPlaceholder}>
          {selDate ? formatDisplay(selDate, withTime) : (placeholder ?? 'Выберите дату')}
        </span>
        {selDate && (
          <span className={styles.clearBtn} onClick={e => { e.stopPropagation(); handleClear(); }}>×</span>
        )}
      </button>

      {/* Календарь — рендерим через portal чтобы не обрезался overflow:hidden родителей */}
      {open && createPortal(
        <div data-datepicker-popup className={styles.popup} style={popupStyle}>
          {/* Хедер */}
          <div className={styles.header}>
            <button type="button" className={styles.navBtn} onClick={prevMonth}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className={styles.monthYear}>{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" className={styles.navBtn} onClick={nextMonth}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          {/* Быстрый выбор года */}
          <div className={styles.yearBar}>
            {yearRange.map(y => (
              <button key={y} type="button"
                className={`${styles.yearBtn} ${y === viewYear ? styles.yearBtnActive : ''}`}
                onClick={() => setViewYear(y)}>
                {y}
              </button>
            ))}
          </div>

          {/* Дни недели */}
          <div className={styles.weekRow}>
            {WEEKDAYS.map(w => <div key={w} className={styles.weekCell}>{w}</div>)}
          </div>

          {/* Сетка дней */}
          <div className={styles.grid}>
            {cells.map((c, i) => (
              <button key={i} type="button"
                disabled={c.month !== 'cur' || isDisabled(c.day)}
                onClick={() => c.month === 'cur' && !isDisabled(c.day) && handleSelect(c.day)}
                className={[
                  styles.day,
                  c.month !== 'cur'            ? styles.dayOther    : '',
                  c.month === 'cur' && isToday(c.day)    ? styles.dayToday    : '',
                  c.month === 'cur' && isSelected(c.day) ? styles.daySelected : '',
                  c.month === 'cur' && isDisabled(c.day) ? styles.dayDisabled : '',
                ].filter(Boolean).join(' ')}
              >{c.day}</button>
            ))}
          </div>

          {/* Время */}
          {withTime && (
            <div className={styles.timePicker}>
              <span className={styles.timeLabel}>Время</span>
              <div className={styles.timeInputs}>
                <input type="number" className={styles.timeInput} min={0} max={23} value={timeH}
                  onChange={e => setTimeH(Math.min(23, Math.max(0, +e.target.value)))} />
                <span className={styles.timeSep}>:</span>
                <input type="number" className={styles.timeInput} min={0} max={59} step={15} value={timeM}
                  onChange={e => setTimeM(Math.min(59, Math.max(0, +e.target.value)))} />
              </div>
            </div>
          )}

          {/* Кнопки */}
          {withTime && (
            <div className={styles.footer}>
              <button type="button" className={styles.cancelBtn} onClick={() => setOpen(false)}>Отмена</button>
              <button type="button" className={styles.okBtn} onClick={handleConfirm} disabled={!selDate}>Выбрать</button>
            </div>
          )}
        </div>
      , document.body)}
    </div>
  );
}
