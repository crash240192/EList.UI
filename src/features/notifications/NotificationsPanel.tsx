// features/notifications/NotificationsPanel.tsx

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccountId } from '@/features/auth/useAccountId';
import type { INotification } from '@/entities/notification/types';
import { getNotificationEventId } from '@/entities/notification/eventData';
import { fetchConnectionStats, sendTestNotification } from '@/entities/notification/api';
import { useNotificationsStore } from './notificationsStore';
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

function notificationTypeText(type: INotification['type']): string {
  if (type == null) return 'Уведомление';
  switch (Number(type)) {
    case 0: return 'Создано событие';
    case 1: return 'Событие обновлено';
    case 2: return 'Событие отменено';
    case 3: return 'Событие завершено';
    case 10: return 'Новый подписчик';
    case 11: return 'Отписка';
    case 12: return 'Подписка связанного пользователя';
    case 13: return 'Отписка связанного пользователя';
    case 20: return 'Участие подтверждено';
    case 21: return 'Отмена участия';
    case 31: return 'Новый ответ в обсуждении';
    case 41: return 'Добавлен в чёрный список';
    case 42: return 'Добавлен в белый список';
    case 43: return 'Удалён из чёрного списка';
    case 44: return 'Удалён из белого списка';
    case 51: return 'Новое приглашение';
    default: return String(type);
  }
}

export function NotificationsPanel({ onClose }: NotificationsPanelProps) {
  const navigate = useNavigate();
  const { accountId } = useAccountId();
  const items = useNotificationsStore(s => s.items);
  const wsStatus = useNotificationsStore(s => s.wsStatus);
  const wsError = useNotificationsStore(s => s.wsError);
  const markRead = useNotificationsStore(s => s.markRead);
  const markAllRead = useNotificationsStore(s => s.markAllRead);
  const clearAll = useNotificationsStore(s => s.clearAll);

  const [testMsg, setTestMsg] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [stats, setStats] = useState<string | null>(null);
  const visibleItems = items.filter(i => !i.readAt);

  const handleMarkAllRead = () => {
    void markAllRead();
  };

  const openNotification = useCallback((n: INotification) => {
    void markRead(n.id);
    const eventId = getNotificationEventId(n);
    if (eventId) {
      onClose();
      navigate(`/event/${eventId}`);
      return;
    }
    if (n.relatedAccountId) {
      onClose();
      navigate(`/user/${n.relatedAccountId}`);
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
          {visibleItems.length > 0 && (
            <button type="button" className={styles.linkBtn} onClick={handleMarkAllRead}>
              Прочитать все
            </button>
          )}
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
            const eventStart = formatEventStart(n.eventShort?.startTime);
            return (
            <li key={n.id}>
              <div className={`${styles.item} ${styles.itemUnread}`}>
                <button
                  type="button"
                  className={styles.itemMain}
                  onClick={() => openNotification(n)}
                >
                  {n.title && <span className={styles.itemTitle}>{n.title}</span>}
                  {n.eventShort?.name && (
                    <span className={styles.itemEventName}>
                      {n.eventShort.colors?.length > 0 && (
                        <span className={styles.itemColorDots} aria-hidden>
                          {n.eventShort.colors.slice(0, 4).map((c, i) => (
                            <span
                              key={`${c}-${i}`}
                              className={styles.itemColorDot}
                              style={{ background: c }}
                            />
                          ))}
                        </span>
                      )}
                      {n.eventShort.name}
                    </span>
                  )}
                  <span className={styles.itemMessage}>
                    {n.message || notificationTypeText(n.type)}
                  </span>
                  {eventStart && (
                    <span className={styles.itemEventWhen}>Начало: {eventStart}</span>
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
        <button type="button" className={styles.clearBtn} onClick={clearAll}>
          Очистить список
        </button>
      )}
    </div>
  );
}
