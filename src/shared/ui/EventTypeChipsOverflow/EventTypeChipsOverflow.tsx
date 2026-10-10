// shared/ui/EventTypeChipsOverflow/EventTypeChipsOverflow.tsx
// Ряд чипов типов с лимитом и popover «…» / «ещё» для полного списка

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  EVENT_TYPE_CHIPS_MAX,
  getEventTypes,
  type EventListItemData,
} from '@/entities/event/lib/eventListItemUtils';
import { EventTypeChip, type EventTypeChipType } from '@/shared/ui/EventTypeChip';
import type { EventTypeChipVariant } from '@/shared/lib/eventTypeChip';
import styles from './EventTypeChipsOverflow.module.css';

interface Props {
  event: EventListItemData;
  maxVisible?: number;
  /** Сколько чипов влезет по ширине (до maxFitLines строк; остальное за «ещё») */
  fitWidth?: boolean;
  /** Макс. строк при fitWidth (по умолчанию 2) */
  maxFitLines?: number;
  variant?: EventTypeChipVariant;
  invert?: boolean;
  iconSize?: number;
  chipClassName?: string;
  className?: string;
  /** Вариант чипа «…» на тёмной обложке */
  moreVariant?: 'overlay' | 'soft';
}

function fitsInLines(
  widths: number[],
  count: number,
  available: number,
  gap: number,
  maxLines: number,
  moreWidth: number | null,
): boolean {
  let lineUsed = 0;
  let lines = 1;

  const place = (w: number) => {
    const next = lineUsed === 0 ? w : lineUsed + gap + w;
    if (next <= available) {
      lineUsed = next;
      return true;
    }
    lines += 1;
    if (lines > maxLines) return false;
    if (w > available) return false;
    lineUsed = w;
    return true;
  };

  for (let i = 0; i < count; i++) {
    if (!place(widths[i])) return false;
  }
  if (moreWidth != null && !place(moreWidth)) return false;
  return true;
}

export function EventTypeChipsOverflow({
  event,
  maxVisible = EVENT_TYPE_CHIPS_MAX,
  fitWidth = false,
  maxFitLines = 2,
  variant = 'overlay',
  invert = false,
  iconSize = 12,
  chipClassName = '',
  className = '',
  moreVariant = 'overlay',
}: Props) {
  const allTypes = getEventTypes(event);
  const [open, setOpen] = useState(false);
  const [fitCount, setFitCount] = useState(allTypes.length);
  const moreRef = useRef<HTMLButtonElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!fitWidth) {
      setFitCount(allTypes.length);
      return;
    }
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;

    const gap = 5;
    const moreMin = moreVariant === 'soft' ? 40 : 28;
    const lines = Math.max(1, maxFitLines);

    const recalc = () => {
      const available = row.clientWidth;
      if (available <= 0) return;
      const chips = [...measure.querySelectorAll<HTMLElement>('[data-measure-chip]')];
      const widths = chips.map(el => el.getBoundingClientRect().width);
      if (widths.length === 0) {
        setFitCount(0);
        return;
      }

      // Все типы влезают в maxFitLines без «ещё»
      if (fitsInLines(widths, widths.length, available, gap, lines, null)) {
        setFitCount(widths.length);
        return;
      }

      // Иначе максимум чипов так, чтобы в конце последней строки ещё влезла кнопка
      let best = 0;
      for (let n = widths.length - 1; n >= 0; n--) {
        if (fitsInLines(widths, n, available, gap, lines, moreMin)) {
          best = n;
          break;
        }
      }
      setFitCount(best);
    };

    recalc();
    const ro = new ResizeObserver(() => recalc());
    ro.observe(row);
    return () => ro.disconnect();
  }, [fitWidth, allTypes, moreVariant, maxFitLines]);

  const limitCap = fitWidth ? fitCount : maxVisible;
  const needsMore = allTypes.length > limitCap;
  const fittedVisible = needsMore
    ? allTypes.slice(0, fitWidth ? limitCap : Math.max(1, limitCap - 1))
    : allTypes;
  const showMore = allTypes.length > fittedVisible.length;

  useEffect(() => {
    if (!open) return;

    const syncPos = () => {
      const btn = moreRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const panelW = 260;
      const left = Math.min(
        Math.max(8, rect.left),
        window.innerWidth - panelW - 8,
      );
      setPanelPos({
        top: Math.max(8, rect.top - 8),
        left,
      });
    };

    syncPos();

    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (moreRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc, true);
    window.addEventListener('resize', syncPos);
    window.addEventListener('scroll', syncPos, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc, true);
      window.removeEventListener('resize', syncPos);
      window.removeEventListener('scroll', syncPos, true);
    };
  }, [open]);

  if (allTypes.length === 0) return null;

  return (
    <div
      ref={rowRef}
      className={`${styles.row} ${fitWidth ? styles.rowFit : ''} ${className}`.trim()}
      style={fitWidth ? { ['--fit-lines' as string]: String(Math.max(1, maxFitLines)) } : undefined}
    >
      {fitWidth && (
        <div ref={measureRef} className={styles.measure} aria-hidden>
          {allTypes.map(t => (
            <span key={t.id} data-measure-chip>
              <EventTypeChip
                type={t}
                variant={variant}
                invert={invert}
                className={chipClassName}
                iconSize={iconSize}
              />
            </span>
          ))}
        </div>
      )}

      {fittedVisible.map(t => (
        <EventTypeChip
          key={t.id}
          type={t}
          variant={variant}
          invert={invert}
          className={chipClassName}
          iconSize={iconSize}
        />
      ))}
      {showMore && (
        <button
          ref={moreRef}
          type="button"
          className={`${styles.moreChip} ${moreVariant === 'overlay' ? styles.moreOverlay : styles.moreSoft}`}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`Ещё типы: ${allTypes.length - fittedVisible.length}`}
          title="Все типы"
          onClick={e => {
            e.stopPropagation();
            setOpen(v => !v);
          }}
        >
          {moreVariant === 'soft' ? 'ещё' : '…'}
        </button>
      )}

      {open && panelPos && createPortal(
        <div
          ref={panelRef}
          id={panelId}
          className={styles.panel}
          role="dialog"
          aria-label="Все типы мероприятия"
          style={{
            top: panelPos.top,
            left: panelPos.left,
            transform: 'translateY(-100%)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className={styles.panelTitle}>Типы мероприятия</div>
          <div className={styles.panelList}>
            {allTypes.map((t: EventTypeChipType) => (
              <EventTypeChip
                key={t.id}
                type={t}
                variant="soft"
                iconSize={12}
              />
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
