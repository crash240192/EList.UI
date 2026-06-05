// shared/ui/DatePicker/DatePicker.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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

const DATE_DIGITS = 8;
const TIME_DIGITS = 4;

function nextFiveMinuteSlot(now: Date): { h: string; m: string } {
  const totalMins = now.getHours() * 60 + now.getMinutes() + 1;
  const rounded = Math.ceil(totalMins / 5) * 5;
  return {
    h: String(Math.floor(rounded / 60) % 24).padStart(2, '0'),
    m: String(rounded % 60).padStart(2, '0'),
  };
}
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

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

function maxDigits(withTime: boolean): number {
  return withTime ? DATE_DIGITS + TIME_DIGITS : DATE_DIGITS;
}

function digitsOnly(raw: string, withTime: boolean): string {
  return raw.replace(/\D/g, '').slice(0, maxDigits(withTime));
}

function formatMaskedFromDigits(digits: string, withTime: boolean): string {
  const datePart = digits.slice(0, DATE_DIGITS);
  let out = '';
  if (datePart.length > 0) out += datePart.slice(0, 2);
  if (datePart.length > 2) out += '.' + datePart.slice(2, 4);
  if (datePart.length > 4) out += '.' + datePart.slice(4, 8);
  if (withTime && digits.length > DATE_DIGITS) {
    const timePart = digits.slice(DATE_DIGITS, DATE_DIGITS + TIME_DIGITS);
    out += ' ' + timePart.slice(0, 2);
    if (timePart.length > 2) out += ':' + timePart.slice(2, 4);
  }
  return out;
}

function isoToMasked(iso: string, withTime: boolean): string {
  const d = parseValue(iso);
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const base = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  if (!withTime) return base;
  return `${base} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function maskedToIso(masked: string, withTime: boolean): string | null {
  const pattern = withTime
    ? /^(\d{2})\.(\d{2})\.(\d{4})\s(\d{2}):(\d{2})$/
    : /^(\d{2})\.(\d{2})\.(\d{4})$/;
  const m = masked.match(pattern);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  if (withTime) {
    const h = parseInt(m[4], 10);
    const mi = parseInt(m[5], 10);
    if (h > 23 || mi > 59) return null;
    d.setHours(h, mi, 0, 0);
    return toISO(d, true);
  }
  return toISO(d, false);
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

function defaultPlaceholder(withTime: boolean): string {
  return withTime ? 'дд.мм.гггг чч:мм' : 'дд.мм.гггг';
}

// Колесо прокрутки для выбора часов/минут
function TimeWheel({ items, selected, onSelect, open }: {
  items: string[];
  selected: string;
  onSelect: (v: string) => void;
  open?: boolean;
}) {
  const ITEM_H = 36;
  const VISIBLE = 5;
  const listRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>();
  const rafRef = useRef<number>(0);
  const [idx, setIdx] = useState(() => Math.max(0, items.indexOf(selected)));

  useEffect(() => {
    const i = Math.max(0, items.indexOf(selected));
    setIdx(i);
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = i * ITEM_H;
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [selected, items, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToIdx = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(items.length - 1, i));
    setIdx(clamped);
    onSelect(items[clamped]);
    if (listRef.current) {
      listRef.current.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' });
    }
  }, [items, onSelect]);

  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (!listRef.current) return;
      const i = Math.round(listRef.current.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, i));
      setIdx(clamped);
      onSelect(items[clamped]);
      listRef.current.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' });
    }, 80);
  }, [items, onSelect]);

  return (
    <div className={styles.wheel} style={{ height: ITEM_H * VISIBLE }}>
      <div className={styles.wheelHighlight} style={{ top: ITEM_H * Math.floor(VISIBLE / 2) }} />
      <div
        ref={listRef}
        className={styles.wheelList}
        onScroll={handleScroll}
        style={{ height: ITEM_H * VISIBLE }}
      >
        <div style={{ height: ITEM_H * Math.floor(VISIBLE / 2) }} />
        {items.map((v, i) => (
          <div key={v}
            className={`${styles.wheelItem} ${i === idx ? styles.wheelItemActive : ''}`}
            style={{ height: ITEM_H }}
            onClick={() => scrollToIdx(i)}>
            {v}
          </div>
        ))}
        <div style={{ height: ITEM_H * Math.floor(VISIBLE / 2) }} />
      </div>
    </div>
  );
}

export function DatePicker({ value, onChange, withTime = false, placeholder, min, max, minTime, className, hasError }: DatePickerProps) {
  const [open, setOpen]       = useState(false);
  const wrapRef               = useRef<HTMLDivElement>(null);
  const fieldRef              = useRef<HTMLDivElement>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const [isMobile, setIsMobile] = useState(false);
  const [inputText, setInputText] = useState(() => isoToMasked(value, withTime));

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
    if (parsed) return String(Math.round(parsed.getMinutes() / 5) * 5 % 60).padStart(2, '0');
    return nextFiveMinuteSlot(nowDefault).m;
  });

  const swipeStartX = useRef<number | null>(null);

  useEffect(() => {
    setInputText(isoToMasked(value, withTime));
    const d = parseValue(value);
    setSelDate(d);
    if (d) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setTimeH(String(d.getHours()).padStart(2, '0'));
      setTimeM(String(Math.round(d.getMinutes() / 5) * 5).padStart(2, '0'));
    }
  }, [value, withTime]);

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

  const commitMasked = useCallback((masked: string) => {
    if (!masked) {
      onChange('');
      return true;
    }
    const iso = maskedToIso(masked, withTime);
    if (!iso || !isInRange(iso, withTime, min, max)) return false;
    onChange(iso);
    setInputText(isoToMasked(iso, withTime));
    return true;
  }, [withTime, min, max, onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = digitsOnly(e.target.value, withTime);
    const masked = formatMaskedFromDigits(digits, withTime);
    setInputText(masked);
    if (digits.length === 0) {
      onChange('');
      return;
    }
    if (digits.length === maxDigits(withTime)) {
      commitMasked(masked);
    }
  };

  const handleInputBlur = () => {
    if (!inputText) {
      onChange('');
      return;
    }
    if (!commitMasked(inputText)) {
      setInputText(isoToMasked(value, withTime));
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
      setInputText(isoToMasked(toISO(d, false), false));
      setOpen(false);
    }
  };

  const handleConfirm = () => {
    const base = selDate ?? nowDefault;
    const d = new Date(base);
    d.setHours(parseInt(timeH, 10) || 0, parseInt(timeM, 10) || 0, 0, 0);
    const iso = toISO(d, true);
    onChange(iso);
    setSelDate(d);
    setInputText(isoToMasked(iso, true));
    setOpen(false);
  };

  const handleClear = () => {
    setSelDate(null);
    setInputText('');
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
  const todayIso = toISO(today, false);
  const effectiveMinTime = minTime ?? (
    isSameDayAsMin && min === todayIso
      ? `${String(today.getHours()).padStart(2,'0')}:${String(today.getMinutes()).padStart(2,'0')}`
      : undefined
  );
  const [minH, minM] = (isSameDayAsMin && effectiveMinTime) ? effectiveMinTime.split(':').map(Number) : [0, 0];
  const availableHours   = HOURS.filter(h => !isSameDayAsMin || parseInt(h) >= minH);
  const availableMinutes = MINUTES.filter(m2 => !isSameDayAsMin || parseInt(timeH) > minH || parseInt(m2) >= minM);
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
          <div className={styles.timeWheels}>
            <TimeWheel items={availableHours}   selected={timeH} onSelect={setTimeH} open={open} />
            <span className={styles.timeSep}>:</span>
            <TimeWheel items={availableMinutes} selected={timeM} onSelect={setTimeM} open={open} />
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

  const fieldPlaceholder = placeholder ?? defaultPlaceholder(withTime);

  return (
    <div ref={wrapRef} className={`${styles.wrap} ${className ?? ''}`}>
      <div ref={fieldRef}
        className={`${styles.field} ${open ? styles.fieldOpen : ''} ${hasError ? styles.fieldError : ''}`}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className={styles.input}
          value={inputText}
          placeholder={fieldPlaceholder}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
        />
        {inputText && (
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
