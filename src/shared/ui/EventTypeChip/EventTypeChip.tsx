import type { CSSProperties } from 'react';
import { icoToUrl } from '@/shared/lib/icoToUrl';
import {
  getEventCategoryColor,
  getEventTypeChipSurface,
  type EventTypeChipVariant,
} from '@/shared/lib/eventTypeChip';
import styles from './EventTypeChip.module.css';

export interface EventTypeChipType {
  id: string;
  name: string;
  ico?: string | null;
  eventCategory?: { color?: string | null } | null;
}

interface EventTypeChipProps {
  type: EventTypeChipType;
  variant?: EventTypeChipVariant;
  /** Инвертировать цвет фона и иконки (независимо от темы). */
  invert?: boolean;
  iconSize?: number;
  className?: string;
  style?: CSSProperties;
  onRemove?: () => void;
}

export function EventTypeChip({
  type,
  variant = 'soft',
  invert = false,
  iconSize = 12,
  className = '',
  style,
  onRemove,
}: EventTypeChipProps) {
  const color = getEventCategoryColor(type);
  const surface = getEventTypeChipSurface(color, variant, { invert });

  return (
    <span
      className={`${styles.chip} ${invert ? styles.chipInvert : ''} ${className}`.trim()}
      style={{ ...surface, ...style }}
    >
      {type.ico && (
        <img
          src={icoToUrl(type.ico) ?? ''}
          alt=""
          width={iconSize}
          height={iconSize}
          className={`${invert ? '' : 'event-type-ico '}${styles.icon}`.trim()}
        />
      )}
      <span className={styles.label}>{type.name}</span>
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          aria-label={`Удалить ${type.name}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
