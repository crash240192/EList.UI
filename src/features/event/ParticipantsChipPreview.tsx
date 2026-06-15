// features/event/ParticipantsChipPreview.tsx
// Превью участников: построчная укладка с градиентом на обрезке по правому краю

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { UserChip, type IUserChipData } from '@/entities/user/ui/UserChip';
import styles from './ParticipantsChipPreview.module.css';

const GAP = 6;
const MAX_ROWS = 2;

interface Row {
  chips: IUserChipData[];
  fade: boolean;
}

function computeRows(
  chips: IUserChipData[],
  widths: number[],
  containerWidth: number,
): Row[] {
  if (!containerWidth || widths.length !== chips.length) return [];

  const rows: Row[] = [];
  let i = 0;

  while (i < chips.length && rows.length < MAX_ROWS) {
    const rowChips: IUserChipData[] = [];
    let used = 0;
    let closed = false;

    while (i < chips.length) {
      const w = widths[i] ?? 0;
      const nextUsed = rowChips.length === 0 ? w : used + GAP + w;

      if (rowChips.length > 0 && nextUsed > containerWidth) {
        rowChips.push(chips[i]);
        i++;
        rows.push({ chips: rowChips, fade: true });
        closed = true;
        break;
      }

      rowChips.push(chips[i]);
      used = nextUsed;
      i++;

      if (i >= chips.length) {
        rows.push({ chips: rowChips, fade: used > containerWidth });
        closed = true;
      }
    }

    if (!closed && rowChips.length > 0) {
      rows.push({ chips: rowChips, fade: used > containerWidth });
    }
  }

  return rows;
}

interface ParticipantsChipPreviewProps {
  participants: IUserChipData[];
}

export function ParticipantsChipPreview({ participants }: ParticipantsChipPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [chipWidths, setChipWidths] = useState<number[]>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const update = () => {
      setContainerWidth(container.clientWidth);
      setChipWidths(
        Array.from(measure.children).map(child => (child as HTMLElement).offsetWidth),
      );
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    return () => ro.disconnect();
  }, [participants]);

  const rows = useMemo(
    () => computeRows(participants, chipWidths, containerWidth),
    [participants, chipWidths, containerWidth],
  );

  return (
    <div ref={containerRef} className={styles.root}>
      <div ref={measureRef} className={styles.measure} aria-hidden>
        {participants.map(p => (
          <UserChip key={p.accountId} user={p} size="sm" clickable={false} />
        ))}
      </div>

      {rows.map((row, index) => (
        <div
          key={index}
          className={`${styles.line} ${row.fade ? styles.lineFade : ''}`}
        >
          <div className={styles.lineInner}>
            {row.chips.map(p => (
              <UserChip key={p.accountId} user={p} size="sm" clickable={false} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
