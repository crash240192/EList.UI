// shared/ui/DatePicker/DatePicker.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  maxDigits,
  sanitizeDateTimeDigits,
  sanitizeTimeDigits,
  isoToDigits,
  digitsToIso,
  timeDigitsToHM,
  hmToTimeDigits,
  isTimeAtOrAfter,
} from '@/shared/lib/dateTimeMask';
import { DateTimeMaskField, TimeMaskField } from './MaskField';
import styles from './DatePicker.module.css';

interface DatePickerProps {
  value: string;
  onChange: (iso: string) => void;
  withTime?: boolean;
  placeholder?: string;
  label?: string;
  min?: string;
  max?: string;
  minTime?: string; // 'HH:MM' — блокируем время если дата = дата начала
  className?: string;
  hasError?: boolean;
}

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                 'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

function nextFiveMinuteSlot(now: Date): { h: string; m: string } {
  const totalMins = now.getHours() * 60 + now.getMinutes() + 1;
  const rounded = Math.ceil(totalMins / 5) * 5;
  return {
    h: String(Math.floor(rounded / 60) % 24).padStart(2, '0'),
    m: String(rounded % 60).padStart(2, '0'),
  };
}
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

function parseValue(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function toISO(date: Date, withTime: boolean): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  if (!withTime) return `${yy}-${mm}-${dd}`;
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yy}-${mm}-${dd}T${hh}:${mi}:00`;
}

function effectiveMinTimeFor(isoDate: string, min?: string, minTime?: string): string | undefined {
  if (!min) return minTime;
  if (isoDate !== min.slice(0, 10)) return minTime;
  if (minTime) return minTime;
  const today = new Date();
  const todayIso = toISO(today, false);
  if (min === todayIso) {
    return `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
  }
  return undefined;
}

function satisfiesMinTime(iso: string, withTime: boolean, min?: string, minTime?: string): boolean {
  if (!withTime || !min) return true;
  const d = parseValue(iso);
  if (!d) return false;
  const eff = effectiveMinTimeFor(iso.slice(0, 10), min, minTime);
  if (!eff) return true;
  const [minH, minM] = eff.split(':').map(Number);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return isTimeAtOrAfter(h, m, minH, minM);
}

function isInRange(iso: string, withTime: boolean, min?: string, max?: string): boolean {
  const d = parseValue(iso);
  if (!d) return false;
  if (min) {
    const minD = parseValue(min);
    if (minD) {
      if (withTime) {
        if (d < minD) return false;
      } else {
        const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const minDay = new Date(minD.getFullYear(), minD.getMonth(), minD.getDate());
        if (dDay < minDay) return false;
      }
    }
  }
  if (max) {
    const maxD = parseValue(max);
    if (maxD) {
      if (withTime) {
        if (d > maxD) return false;
      } else {
        const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const maxDay = new Date(maxD.getFullYear(), maxD.getMonth(), maxD.getDate());
        if (dDay > maxDay) return false;
      }
    }
  }
  return true;
}

const MASK_EMPTY_LABELS = new Set(['Любая']);

export function DatePicker({ value, onChange, withTime = false, placeholder, min, max, minTime, className, hasError }: DatePickerProps) {
  const [open, setOpen]       = useState(false);
  const wrapRef               = useRef<HTMLDivElement>(null);
  const fieldRef              = useRef<HTMLDivElement>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const [isMobile, setIsMobile] = useState(false);
  const [inputDigits, setInputDigits] = useState(() => isoToDigits(value, withTime));

  const parsed = parseValue(value);
  const nowDefault = new Date();
  const [viewYear,  setViewYear]  = useState(() => {
    if (parsed) return parsed.getFullYear();
    if (max) return parseInt(max.slice(0, 4));
    return nowDefault.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => parsed?.getMonth() ?? nowDefault.getMonth());
  const [selDate,   setSelDate]   = useState<Date | null>(parsed ?? (withTime ? new Date(nowDefault) : null));
  const [timeH, setTimeH] = useState(() => {
    if (parsed) return String(parsed.getHours()).padStart(2, '0');
    return nextFiveMinuteSlot(nowDefault).h;
  });
  const [timeM, setTimeM] = useState(() => {
    if (parsed) return String(parsed.getMinutes()).padStart(2, '0');
    return nextFiveMinuteSlot(nowDefault).m;
  });
  const [timeDigits, setTimeDigits] = useState(() => {
    if (parsed) {
      return hmToTimeDigits(
        String(parsed.getHours()).padStart(2, '0'),
        String(parsed.getMinutes()).padStart(2, '0'),
      );
    }
    const slot = nextFiveMinuteSlot(nowDefault);
    return slot.h + slot.m;
  });

  const swipeStartX = useRef<number | null>(null);

  const syncTimeFromHM = useCallback((h: string, m: string) => {
    setTimeH(h);
    setTimeM(m);
    setTimeDigits(hmToTimeDigits(h, m));
  }, []);

  useEffect(() => {
    setInputDigits(isoToDigits(value, withTime));
    const d = parseValue(value);
    setSelDate(d);
    if (d) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      syncTimeFromHM(h, m);
    }
  }, [value, withTime, syncTimeFromHM]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current && !wrapRef.current.contains(target)) {
        if (!popupRef.current || !popupRef.current.contains(target)) setOpen(false);
      }
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', fn);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fn); document.removeEventListener('keydown', esc); };
  }, []);

  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const popup = popupRef.current;
    if (!popup) return;

    const mobile = window.innerWidth < 600;
    setIsMobile(mobile);

    if (!open) {
      popup.style.display = 'none';
      return;
    }

    if (mobile) {
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      const W = Math.min(320, viewW - 16);
      popup.style.display   = 'block';
      popup.style.position  = 'fixed';
      popup.style.width     = W + 'px';
      popup.style.left      = Math.max(8, Math.round((viewW - W) / 2)) + 'px';
      popup.style.top       = Math.max(8, Math.round((viewH - popup.offsetHeight) / 2)) + 'px';
      popup.style.zIndex    = '9999';
      return;
    }

    if (!fieldRef.current) return;
    const rect  = fieldRef.current.getBoundingClientRect();
    const viewH = window.innerHeight;
    const viewW = window.innerWidth;
    const W     = 296;
    const left  = Math.max(4, Math.min(rect.left, viewW - W - 8));

    popup.style.display  = 'block';
    popup.style.position = 'fixed';
    popup.style.width    = W + 'px';
    popup.style.left     = left + 'px';
    popup.style.top      = '-9999px';
    popup.style.zIndex   = '9999';

    const popupH = popup.offsetHeight;
    const SAFE   = 8;

    let top = rect.bottom + 6;
    if (top + popupH + SAFE > viewH) top = viewH - popupH - SAFE;
    if (top < 4) top = 4;

    popup.style.top = top + 'px';
  }, [open]);

  const processDateTimeRaw = useCallback(
    (raw: string) => sanitizeDateTimeDigits(raw, withTime, min, max),
    [withTime, min, max],
  );

  const commitDigits = useCallback((digits: string) => {
    if (!digits) {
      onChange('');
      return true;
    }
    const iso = digitsToIso(digits, withTime);
    if (!iso || !isInRange(iso, withTime, min, max) || !satisfiesMinTime(iso, withTime, min, minTime)) return false;
    onChange(iso);
    setInputDigits(isoToDigits(iso, withTime));
    return true;
  }, [withTime, min, max, minTime, onChange]);

  const handleDigitsChange = (digits: string) => {
    setInputDigits(digits);
    if (digits.length === 0) {
      onChange('');
      return;
    }
    if (digits.length === maxDigits(withTime)) {
      commitDigits(digits);
    }
  };

  const handleDigitsBlur = () => {
    if (!inputDigits) {
      onChange('');
      return;
    }
    if (inputDigits.length === maxDigits(withTime)) {
      if (!commitDigits(inputDigits)) setInputDigits(isoToDigits(value, withTime));
    } else {
      setInputDigits(isoToDigits(value, withTime));
    }
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
  };
  const handleSwipeTouchEnd = (e: React.TouchEvent) => {
    if (swipeStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    if (Math.abs(dx) > 40) { if (dx < 0) nextMonth(); else prevMonth(); }
    swipeStartX.current = null;
  };

  const handleSelect = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    if (withTime) {
      d.setHours(parseInt(timeH, 10), parseInt(timeM, 10), 0, 0);
    }
    setSelDate(d);
    if (!withTime) {
      onChange(toISO(d, false));
      setInputDigits(isoToDigits(toISO(d, false), false));
      setOpen(false);
    }
  };

  const handleConfirm = () => {
    const base = selDate ?? nowDefault;
    const d = new Date(base);
    d.setHours(parseInt(timeH, 10) || 0, parseInt(timeM, 10) || 0, 0, 0);
    const iso = toISO(d, true);
    if (!isInRange(iso, true, min, max) || !satisfiesMinTime(iso, true, min, minTime)) return;
    onChange(iso);
    setSelDate(d);
    setInputDigits(isoToDigits(iso, true));
    setOpen(false);
  };

  const handleClear = () => {
    setSelDate(null);
    setInputDigits('');
    onChange('');
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const offset   = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev  = new Date(viewYear, viewMonth, 0).getDate();
  const cells: { day: number; month: 'prev'|'cur'|'next' }[] = [];
  for (let i = offset - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, month: 'prev' });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, month: 'cur' });
  const needed = Math.ceil(cells.length / 7) * 7;
  for (let d = 1; cells.length < needed; d++) cells.push({ day: d, month: 'next' });

  const today = new Date();
  const isToday    = (d: number) => d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
  const effectiveSel = selDate ?? (withTime ? today : null);
  const isSelected = (d: number) => effectiveSel
    ? d === effectiveSel.getDate() && viewMonth === effectiveSel.getMonth() && viewYear === effectiveSel.getFullYear()
    : false;
  const isDisabled = (d: number) => {
    const dt = new Date(viewYear, viewMonth, d);
    if (min) {
      const [my, mm, md] = min.split('-').map(Number);
      const minDt = new Date(my, mm - 1, md);
      if (dt < minDt) return true;
    }
    if (max) {
      const [my, mm, md] = max.split('-').map(Number);
      const maxDt = new Date(my, mm - 1, md);
      if (dt > maxDt) return true;
    }
    return false;
  };

  const currentYear = new Date().getFullYear();
  const isSameDayAsMin = selDate && min
    ? (() => { const [y,m,d] = min.split('-').map(Number); return selDate.getFullYear()===y && selDate.getMonth()===m-1 && selDate.getDate()===d; })()
    : false;
  const effectiveMinTime = selDate && min
    ? effectiveMinTimeFor(toISO(selDate, false), min, minTime)
    : undefined;
  const [minH, minM] = (isSameDayAsMin && effectiveMinTime) ? effectiveMinTime.split(':').map(Number) : [0, 0];

  const commitPopupTime = useCallback((digits: string): boolean => {
    const hm = timeDigitsToHM(digits);
    if (!hm) return false;
    if (isSameDayAsMin && !isTimeAtOrAfter(hm.h, hm.m, minH, minM)) return false;
    syncTimeFromHM(hm.h, hm.m);
    return true;
  }, [isSameDayAsMin, minH, minM, syncTimeFromHM]);

  const handleTimeDigitsChange = (digits: string) => {
    setTimeDigits(digits);
    if (digits.length === 4) commitPopupTime(digits);
  };

  const handleTimeDigitsBlur = () => {
    if (!timeDigits) {
      syncTimeFromHM(timeH, timeM);
      return;
    }
    if (timeDigits.length === 4) {
      if (!commitPopupTime(timeDigits)) setTimeDigits(hmToTimeDigits(timeH, timeM));
    } else {
      setTimeDigits(hmToTimeDigits(timeH, timeM));
    }
  };

  const minYear = min ? parseInt(min.slice(0, 4)) : 1900;
  const maxYear = max ? parseInt(max.slice(0, 4)) : currentYear + 10;
  const yearRange: number[] = [];
  for (let y = minYear; y <= maxYear; y++) yearRange.push(y);

  const yearListRef = useRef<HTMLDivElement>(null);

  const scrollToActiveYear = useCallback(() => {
    if (!yearListRef.current) return;
    const btn = yearListRef.current.querySelector('[data-year-active]') as HTMLElement;
    if (btn) btn.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      if (!yearListRef.current) return;
      const btn = yearListRef.current.querySelector('[data-year-active]') as HTMLElement;
      if (!btn) return;
      const container = yearListRef.current;
      const btnOffset = btn.offsetLeft;
      const btnWidth  = btn.offsetWidth;
      container.scrollLeft = btnOffset - container.clientWidth / 2 + btnWidth / 2;
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(scrollToActiveYear);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear]);

  const popupContent = (
    <div data-datepicker-popup
      ref={popupRef}
      className={`${styles.popup} ${isMobile ? styles.popupModal : ''}`}
      style={isMobile ? undefined : popupStyle}>

      <div className={styles.header}
        onTouchStart={handleSwipeTouchStart}
        onTouchEnd={handleSwipeTouchEnd}>
        <button type="button" className={styles.navBtn} onClick={prevMonth}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className={styles.monthYear}>{MONTHS[viewMonth]} {viewYear}</span>
        <button type="button" className={styles.navBtn} onClick={nextMonth}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div className={styles.yearBar}>
        <button type="button" className={styles.yearNavBtn}
          onClick={() => setViewYear(y => Math.max(minYear, y - 1))}
          disabled={viewYear <= minYear}>
          ‹
        </button>
        <div className={styles.yearList} ref={yearListRef}>
          {yearRange.map(y => (
            <button key={y} type="button"
              data-year-active={y === viewYear ? '' : undefined}
              className={`${styles.yearBtn} ${y === viewYear ? styles.yearBtnActive : ''}`}
              onClick={() => setViewYear(y)}>
              {y}
            </button>
          ))}
        </div>
        <button type="button" className={styles.yearNavBtn}
          onClick={() => setViewYear(y => Math.min(maxYear, y + 1))}
          disabled={viewYear >= maxYear}>
          ›
        </button>
      </div>

      <div className={styles.weekRow}>
        {WEEKDAYS.map(w => <div key={w} className={styles.weekCell}>{w}</div>)}
      </div>

      <div className={styles.grid}
        onTouchStart={handleSwipeTouchStart}
        onTouchEnd={handleSwipeTouchEnd}>
        {cells.map((c, i) => (
          <button key={i} type="button"
            disabled={c.month !== 'cur' || isDisabled(c.day)}
            onClick={() => c.month === 'cur' && !isDisabled(c.day) && handleSelect(c.day)}
            className={[
              styles.day,
              c.month !== 'cur'                          ? styles.dayOther    : '',
              c.month === 'cur' && isToday(c.day)        ? styles.dayToday    : '',
              c.month === 'cur' && isSelected(c.day)     ? styles.daySelected : '',
              c.month === 'cur' && isDisabled(c.day)     ? styles.dayDisabled : '',
            ].filter(Boolean).join(' ')}
          >{c.day}</button>
        ))}
      </div>

      {withTime && (
        <div className={styles.timePicker}>
          <span className={styles.timeLabel}>Время</span>
          <div className={styles.timeMaskWrap}>
            <TimeMaskField
              digits={timeDigits}
              onDigitsChange={handleTimeDigitsChange}
              onBlur={handleTimeDigitsBlur}
              processRaw={sanitizeTimeDigits}
              ariaLabel="чч:мм"
            />
          </div>
        </div>
      )}

      <div className={styles.footer}>
        <button type="button" className={styles.cancelBtn} onClick={() => setOpen(false)}>Отмена</button>
        <button type="button" className={styles.okBtn} onClick={withTime ? handleConfirm : () => setOpen(false)} disabled={!withTime && !selDate}>
          {withTime ? 'Выбрать' : 'OK'}
        </button>
      </div>
    </div>
  );

  const emptyLabel = placeholder && MASK_EMPTY_LABELS.has(placeholder) ? placeholder : undefined;
  const ariaLabel = placeholder ?? (withTime ? 'дд.мм.гггг чч:мм' : 'дд.мм.гггг');

  return (
    <div ref={wrapRef} className={`${styles.wrap} ${className ?? ''}`}>
      <div ref={fieldRef}
        className={`${styles.field} ${open ? styles.fieldOpen : ''} ${hasError ? styles.fieldError : ''}`}>
        <DateTimeMaskField
          digits={inputDigits}
          onDigitsChange={handleDigitsChange}
          onBlur={handleDigitsBlur}
          withTime={withTime}
          emptyLabel={emptyLabel}
          ariaLabel={ariaLabel}
          processRaw={processDateTimeRaw}
        />
        {inputDigits.length > 0 && (
          <button type="button" className={styles.clearBtn} aria-label="Очистить"
            onClick={handleClear}>×</button>
        )}
        <button type="button" className={styles.calendarBtn} aria-label="Открыть календарь"
          onClick={() => setOpen(v => !v)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.icon}>
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </button>
      </div>

      {createPortal(
        <>
          <div className={styles.backdrop}
               onClick={() => setOpen(false)}
               style={{ display: (open && isMobile) ? 'block' : 'none', zIndex: 9998, position: 'fixed', inset: 0 }} />
          {popupContent}
        </>,
        document.body
      )}
    </div>
  );
}
