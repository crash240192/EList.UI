// shared/ui/DatePicker/DatePicker.tsx

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
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

function nextFiveMinuteSlot(now: Date): { h: string; m: string } {
  const totalMins = now.getHours() * 60 + now.getMinutes() + 1; // +1 гарантирует будущее
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

function formatDisplay(date: Date, withTime: boolean): string {
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  if (!withTime) return `${day} ${month} ${year}`;
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hh}:${mm}`;
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
    // rAF гарантирует, что display:block уже применён до установки scrollTop
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = i * ITEM_H;
    });
    return () => cancelAnimationFrame(rafRef.current);
  // open в deps: при открытии попапа эффект пересчитывается даже если selected не менялся
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
      // Снэп к ячейке после остановки
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
  const fieldRef              = useRef<HTMLButtonElement>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const [isMobile, setIsMobile] = useState(false);

  const parsed = parseValue(value);
  // Дефолт для selDate — текущие дата/время если не выбрано (кнопка сразу активна)
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

  // Свайп месяцев
  const swipeStartX = useRef<number | null>(null);

  useEffect(() => {
    const d = parseValue(value);
    setSelDate(d);
    if (d) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setTimeH(String(d.getHours()).padStart(2, '0'));
      setTimeM(String(Math.round(d.getMinutes() / 5) * 5).padStart(2, '0'));
    }
  }, [value]);

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

  // Позиционирование в стиле flatpickr: попап всегда в DOM,
  // показываем/скрываем через display, позиционируем синхронно
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
      // Мобиль: по центру экрана
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

    // Десктоп: flatpickr-стиль
    if (!fieldRef.current) return;
    const rect  = fieldRef.current.getBoundingClientRect();
    const viewH = window.innerHeight;
    const viewW = window.innerWidth;
    const W     = 296;
    const left  = Math.max(4, Math.min(rect.left, viewW - W - 8));

    // Сначала рендерим за экраном чтобы измерить реальную высоту
    popup.style.display  = 'block';
    popup.style.position = 'fixed';
    popup.style.width    = W + 'px';
    popup.style.left     = left + 'px';
    popup.style.top      = '-9999px';
    popup.style.zIndex   = '9999';

    // offsetHeight теперь реальный (элемент в DOM с заданной шириной)
    const popupH = popup.offsetHeight;
    const SAFE   = 8;

    let top = rect.bottom + 6;
    if (top + popupH + SAFE > viewH) top = viewH - popupH - SAFE;
    if (top < 4) top = 4;

    popup.style.top = top + 'px';
  }, [open]);

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
      setOpen(false);
    }
  };

  const handleConfirm = () => {
    const base = selDate ?? nowDefault; // если дата не кликнута — берём текущую
    const d = new Date(base);
    d.setHours(parseInt(timeH, 10) || 0, parseInt(timeM, 10) || 0, 0, 0);
    onChange(toISO(d, true));
    setSelDate(d);
    setOpen(false);
  };

  const handleClear = () => {
    setSelDate(null);
    onChange('');
  };

  // Строим ячейки календаря
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
    const dt = new Date(viewYear, viewMonth, d); // локальное время
    if (min) {
      const [my, mm, md] = min.split('-').map(Number);
      const minDt = new Date(my, mm - 1, md); // тоже локальное
      if (dt < minDt) return true;
    }
    if (max) {
      const [my, mm, md] = max.split('-').map(Number);
      const maxDt = new Date(my, mm - 1, md);
      if (dt > maxDt) return true;
    }
    return false;
  };

  // Если выбранная дата совпадает с min — ограничиваем время
  const currentYear = new Date().getFullYear();
  const isSameDayAsMin = selDate && min
    ? (() => { const [y,m,d] = min.split('-').map(Number); return selDate.getFullYear()===y && selDate.getMonth()===m-1 && selDate.getDate()===d; })()
    : false;
  // Автоматически ограничиваем время текущим моментом, если выбран сегодняшний день и min = сегодня
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

  // Скроллим к выбранному году при открытии
  const yearListRef = useRef<HTMLDivElement>(null);

  const scrollToActiveYear = useCallback(() => {
    if (!yearListRef.current) return;
    const btn = yearListRef.current.querySelector('[data-year-active]') as HTMLElement;
    if (btn) btn.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  // Центрируем год при открытии
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

  // Центрируем год при каждом его изменении (стрелки, клик)
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

      {/* Шапка с навигацией */}
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

      {/* Быстрый выбор года со стрелками */}
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

      {/* Дни недели */}
      <div className={styles.weekRow}>
        {WEEKDAYS.map(w => <div key={w} className={styles.weekCell}>{w}</div>)}
      </div>

      {/* Сетка дней — свайп */}
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

      {/* Колёса времени */}
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

      {/* Кнопки подтверждения */}
      <div className={styles.footer}>
        <button type="button" className={styles.cancelBtn} onClick={() => setOpen(false)}>Отмена</button>
        <button type="button" className={styles.okBtn} onClick={withTime ? handleConfirm : () => setOpen(false)} disabled={!withTime && !selDate}>
          {withTime ? 'Выбрать' : 'OK'}
        </button>
      </div>
    </div>
  );

  return (
    <div ref={wrapRef} className={`${styles.wrap} ${className ?? ''}`}>
      <button ref={fieldRef} type="button"
        className={`${styles.field} ${open ? styles.fieldOpen : ''} ${hasError ? styles.fieldError : ''}`}
        onClick={() => setOpen(v => !v)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.icon}>
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span className={selDate ? styles.fieldValue : styles.fieldPlaceholder}>
          {selDate ? formatDisplay(selDate, withTime) : (placeholder ?? 'Выберите дату')}
        </span>
        {selDate && <span className={styles.clearBtn} onClick={e => { e.stopPropagation(); handleClear(); }}>×</span>}
      </button>

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
