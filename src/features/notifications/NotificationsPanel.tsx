// features/notifications/NotificationsPanel.tsx

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccountId } from '@/features/auth/useAccountId';
import type { INotification } from '@/entities/notification/types';
import { isEventPageNotificationType } from '@/entities/notification/eventData';
import {
  getNotificationNavigationTarget,
  notificationTypeLabel,
} from '@/entities/notification/notificationNavigation';
import { fetchConnectionStats, sendTestNotification } from '@/entities/notification/api';
import { useNotificationsStore } from './notificationsStore';
import { useDebouncedWsStatus } from './useDebouncedWsStatus';
import styles from './NotificationsPanel.module.css';

interface NotificationsPanelProps {
  onClose: () => void;
}

function formatEventStart(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function NotificationsPanel({ onClose }: NotificationsPanelProps) {
  const navigate = useNavigate();
  const { accountId } = useAccountId();
  const items = useNotificationsStore(s => s.items);
  const wsStatus = useDebouncedWsStatus(useNotificationsStore(s => s.wsStatus));
  const wsError = useNotificationsStore(s => s.wsError);
  const markRead = useNotificationsStore(s => s.markRead);
  const clearAll = useNotificationsStore(s => s.clearAll);

  const [testMsg, setTestMsg] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [stats, setStats] = useState<string | null>(null);
  const visibleItems = items.filter(i => !i.readAt);

  const openNotification = useCallback((n: INotification) => {
    void markRead(n.id);
    const target = getNotificationNavigationTarget(n);
    if (!target) return;

    onClose();
    switch (target.kind) {
      case 'invitations':
        navigate('/invitations');
        break;
      case 'event':
        navigate(`/event/${target.eventId}`);
        break;
      case 'user':
        navigate(`/user/${target.accountId}`);
        break;
    }
  }, [markRead, navigate, onClose]);

  const closeNotification = useCallback((n: INotification) => {
    void markRead(n.id);
  }, [markRead]);

  const handleTestSend = async () => {
    if (!accountId || !testMsg.trim()) return;
    setTestSending(true);
    try {
      await sendTestNotification(accountId, {
        message: testMsg.trim(),
        title: 'Тест',
        type: 'test',
      });
      setTestMsg('');
    } catch {
      /* toast from apiClient */
    } finally {
      setTestSending(false);
    }
  };

  const loadStats = async () => {
    try {
      const s = await fetchConnectionStats();
      setStats(
        `подключений: ${s.totalConnectionsCount ?? '—'}, аккаунтов: ${s.connectedAccountCounts ?? '—'}`,
      );
    } catch {
      setStats('не удалось загрузить stats');
    }
  };

  return (
    <div className={styles.panel} role="dialog" aria-label="Уведомления">
      <div className={styles.head}>
        <h2 className={styles.title}>Уведомления</h2>
        <div className={styles.headActions}>
          <button type="button" className={styles.iconClose} onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
      </div>

      <div className={styles.statusRow}>
        <span className={`${styles.wsPill} ${styles[`ws_${wsStatus}`]}`}>
          {wsStatus === 'open' && 'Онлайн'}
          {wsStatus === 'connecting' && 'Подключение…'}
          {wsStatus === 'closed' && 'Переподключение…'}
          {wsStatus === 'error' && (wsError || 'Ошибка')}
          {wsStatus === 'idle' && '—'}
        </span>
        <button type="button" className={styles.linkBtn} onClick={loadStats}>
          Stats
        </button>
        {stats && <span className={styles.statsText}>{stats}</span>}
      </div>

      <ul className={styles.list}>
        {visibleItems.length === 0 ? (
          <li className={styles.empty}>
            Пока нет уведомлений. Новые появятся здесь по WebSocket.
          </li>
        ) : (
          visibleItems.map(n => {
            const hasTitle = !!n.title;
            const messageText = n.message || notificationTypeLabel(n.type);
            const eventStart = formatEventStart(n.eventShort?.startTime);
            const ratingHint = n.ratingData
              ? `Оценка: ${n.ratingData.value}${n.ratingData.comment ? ` · ${n.ratingData.comment}` : ''}`
              : null;
            const showEventName = !!n.eventShort?.name && (hasTitle || isEventPageNotificationType(n.type));
            return (
            <li key={n.id}>
              <div className={`${styles.item} ${styles.itemUnread}`}>
                <button
                  type="button"
                  className={styles.itemMain}
                  onClick={() => openNotification(n)}
                >
                  {hasTitle ? (
                    <>
                      <span className={styles.itemTitle}>{n.title}</span>
                      {showEventName && (
                        <span className={styles.itemEventName}>
                          {n.eventShort!.colors?.length > 0 && (
                            <span className={styles.itemColorDots} aria-hidden>
                              {n.eventShort!.colors.slice(0, 4).map((c, i) => (
                                <span
                                  key={`${c}-${i}`}
                                  className={styles.itemColorDot}
                                  style={{ background: c }}
                                />
                              ))}
                            </span>
                          )}
                          {n.eventShort!.name}
                        </span>
                      )}
                      {n.message && (
                        <span className={styles.itemMessage}>{n.message}</span>
                      )}
                      {ratingHint && (
                        <span className={styles.itemMessage}>{ratingHint}</span>
                      )}
                      {eventStart && (
                        <span className={styles.itemEventWhen}>Начало: {eventStart}</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className={styles.itemMessageOnly}>{messageText}</span>
                      {showEventName && (
                        <span className={styles.itemEventName}>
                          {n.eventShort!.colors?.length > 0 && (
                            <span className={styles.itemColorDots} aria-hidden>
                              {n.eventShort!.colors.slice(0, 4).map((c, i) => (
                                <span
                                  key={`${c}-${i}`}
                                  className={styles.itemColorDot}
                                  style={{ background: c }}
                                />
                              ))}
                            </span>
                          )}
                          {n.eventShort!.name}
                        </span>
                      )}
                      {ratingHint && (
                        <span className={styles.itemMessage}>{ratingHint}</span>
                      )}
                      {eventStart && (
                        <span className={styles.itemEventWhen}>Начало: {eventStart}</span>
                      )}
                    </>
                  )}
                  <span className={styles.itemMeta}>{formatWhen(n.createdAt)}</span>
                </button>
                <button
                  type="button"
                  className={styles.itemDismiss}
                  onClick={() => closeNotification(n)}
                  aria-label="Скрыть уведомление"
                  title="Отметить прочитанным"
                >
                  ×
                </button>
              </div>
            </li>
          );
          })
        )}
      </ul>

      {import.meta.env.DEV && accountId && (
        <div className={styles.testRow}>
          <input
            className={styles.testInput}
            placeholder="Тест: текст уведомления"
            value={testMsg}
            onChange={e => setTestMsg(e.target.value)}
          />
          <button
            type="button"
            className={styles.testBtn}
            disabled={testSending || !testMsg.trim()}
            onClick={handleTestSend}
          >
            Send
          </button>
        </div>
      )}

      {visibleItems.length > 0 && (
        <button type="button" className={styles.clearBtn} onClick={() => { void clearAll(); }}>
          Очистить
        </button>
      )}
    </div>
  );
}
