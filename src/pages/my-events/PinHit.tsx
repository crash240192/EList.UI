import { useRef, type PointerEvent, type ReactNode } from 'react';
import styles from './MyEventsPage.module.css';

const HOLD_MS = 500;
const MOVE_PX = 10;
const SUPPRESS_CLICK_MS = 400;

interface PinHitProps {
  className?: string;
  children: ReactNode;
  onOpenMenu: (x: number, y: number) => void;
}

export function PinHit({ className, children, onOpenMenu }: PinHitProps) {
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const suppressUntilRef = useRef(0);

  const clearTimer = () => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const open = (x: number, y: number, haptic: boolean) => {
    suppressUntilRef.current = Date.now() + SUPPRESS_CLICK_MS;
    onOpenMenu(x, y);
    if (haptic && navigator.vibrate) navigator.vibrate(40);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' || e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    const x = e.clientX;
    const y = e.clientY;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      startRef.current = null;
      open(x, y, true);
    }, HOLD_MS);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dx * dx + dy * dy > MOVE_PX * MOVE_PX) {
      clearTimer();
      startRef.current = null;
    }
  };

  const endHold = () => {
    clearTimer();
    startRef.current = null;
  };

  return (
    <div
      className={[styles.pinHit, className].filter(Boolean).join(' ')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endHold}
      onPointerCancel={endHold}
      onClickCapture={(e) => {
        if (Date.now() >= suppressUntilRef.current) return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        clearTimer();
        startRef.current = null;
        open(e.clientX, e.clientY, false);
      }}
    >
      {children}
    </div>
  );
}
