// features/notifications/useDebouncedWsStatus.ts

import { useEffect, useState } from 'react';
import type { NotificationWsStatus } from '@/entities/notification/types';

/** «Онлайн» сразу; «переподключение» — только если не open дольше delayMs (меньше мигания) */
export function useDebouncedWsStatus(
  status: NotificationWsStatus,
  delayMs = 900,
): NotificationWsStatus {
  const [display, setDisplay] = useState(status);

  useEffect(() => {
    if (status === 'open') {
      setDisplay('open');
      return;
    }
    const t = setTimeout(() => setDisplay(status), delayMs);
    return () => clearTimeout(t);
  }, [status, delayMs]);

  return display;
}
