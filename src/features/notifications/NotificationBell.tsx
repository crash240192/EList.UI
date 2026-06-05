// features/notifications/NotificationBell.tsx

import { useEffect, useRef } from 'react';
import { ensureNotificationSoundUnlocked } from '@/shared/lib/playNotificationPop';
import { useNotificationsStore } from './notificationsStore';
import { useDebouncedWsStatus } from './useDebouncedWsStatus';
import { useNotificationsWebSocket } from './useNotificationsWebSocket';
import { NotificationsPanel } from './NotificationsPanel';
import styles from './NotificationBell.module.css';

export function NotificationBell() {
  useNotificationsWebSocket(true);
  ensureNotificationSoundUnlocked();

  const panelOpen = useNotificationsStore(s => s.panelOpen);
  const togglePanel = useNotificationsStore(s => s.togglePanel);
  const setPanelOpen = useNotificationsStore(s => s.setPanelOpen);
  const unread = useNotificationsStore(s => s.items.filter(i => !i.readAt).length);
  const wsStatus = useDebouncedWsStatus(useNotificationsStore(s => s.wsStatus));

  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [panelOpen, setPanelOpen]);

  const statusHint =
    wsStatus === 'open' ? 'Подключено'
      : wsStatus === 'connecting' ? 'Подключение…'
        : wsStatus === 'error' ? 'Нет связи'
          : wsStatus === 'closed' ? 'Переподключение…'
            : '';

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.bellBtn}
        onClick={togglePanel}
        aria-label="Уведомления"
        aria-expanded={panelOpen}
        title={statusHint || 'Уведомления'}
      >
        <BellIcon />
        {unread > 0 && (
          <span className={styles.badge} aria-hidden>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
        {wsStatus !== 'open' && wsStatus !== 'idle' && (
          <span className={`${styles.statusDot} ${styles[`status_${wsStatus}`]}`} aria-hidden />
        )}
      </button>

      {panelOpen && <NotificationsPanel onClose={() => setPanelOpen(false)} />}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
