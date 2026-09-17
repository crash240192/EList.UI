// shared/ui/EventTypeChipsOverflow/EventTypeChipsOverflow.tsx
// Ряд чипов типов с лимитом и popover «…» для полного списка

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
  /** Сколько чипов влезет по ширине ряда (остальное за «…») */
  fitWidth?: boolean;
  variant?: EventTypeChipVariant;
  invert?: boolean;
  iconSize?: number;
  chipClassName?: string;
  className?: string;
  /** Вариант чипа «…» на тёмной обложке */
  moreVariant?: 'overlay' | 'soft';
}

export function EventTypeChipsOverflow({
  event,
  maxVisible = EVENT_TYPE_CHIPS_MAX,
  fitWidth = false,
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

    const recalc = () => {
      const available = row.clientWidth;
      if (available <= 0) return;
      const chips = [...measure.querySelectorAll<HTMLElement>('[data-measure-chip]')];
      const widths = chips.map(el => el.getBoundingClientRect().width);
      if (widths.length === 0) {
        setFitCount(0);
        return;
      }

      let used = 0;
      let count = 0;
      for (let i = 0; i < widths.length; i++) {
        const w = widths[i];
        const next = used + (count > 0 ? gap : 0) + w;
        const rest = widths.length - (i + 1);
        if (rest === 0) {
          if (next <= available) {
            count = i + 1;
            used = next;
          }
          break;
        }
        const withMore = next + gap + moreMin;
        if (withMore <= available) {
          count = i + 1;
          used = next;
          continue;
        }
        break;
      }
      setFitCount(Math.max(0, count));
    };

    recalc();
    const ro = new ResizeObserver(() => recalc());
    ro.observe(row);
    return () => ro.disconnect();
  }, [fitWidth, allTypes, moreVariant]);

  const limitCap = fitWidth ? fitCount : maxVisible;
  const needsMore = allTypes.length > limitCap;
  // Count-based mode reserves one slot for «…»; fitWidth already reserved space while measuring.
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
