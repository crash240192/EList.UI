import { useEffect, useState } from 'react';

/**
 * Показывает «вторую фазу» UI (спиннер и т.п.) только если `active` непрерывно true дольше `delayMs`.
 * При сбросе `active` скрывает сразу, без задержки.
 */
export function useDelayedBusy(active: boolean, delayMs: number): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const id = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(id);
  }, [active, delayMs]);

  return visible;
}
