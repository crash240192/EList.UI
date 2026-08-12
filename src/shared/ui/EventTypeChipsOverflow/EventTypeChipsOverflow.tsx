// shared/ui/EventTypeChipsOverflow/EventTypeChipsOverflow.tsx
// Ряд чипов типов с лимитом и popover «…» для полного списка

import { useEffect, useId, useRef, useState } from 'react';
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
  variant = 'overlay',
  invert = false,
  iconSize = 12,
  chipClassName = '',
  className = '',
  moreVariant = 'overlay',
}: Props) {
  const allTypes = getEventTypes(event);
  const [open, setOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);

  const hasOverflow = allTypes.length > maxVisible;
  const visibleTypes = hasOverflow
    ? allTypes.slice(0, Math.max(1, maxVisible - 1))
    : allTypes;

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
      // Открываем вверх от чипа, чтобы не уезжать под низ экрана в bottom-sheet
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
    <div className={`${styles.row} ${className}`.trim()}>
      {visibleTypes.map(t => (
        <EventTypeChip
          key={t.id}
          type={t}
          variant={variant}
          invert={invert}
          className={chipClassName}
          iconSize={iconSize}
        />
      ))}
      {hasOverflow && (
        <button
          ref={moreRef}
          type="button"
          className={`${styles.moreChip} ${moreVariant === 'overlay' ? styles.moreOverlay : styles.moreSoft}`}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`Ещё типы: ${allTypes.length - visibleTypes.length}`}
          title="Все типы"
          onClick={e => {
            e.stopPropagation();
            setOpen(v => !v);
          }}
        >
          …
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
