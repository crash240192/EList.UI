// Окно выбора своих мероприятий и предупреждение, если человек не подписан.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchEvents } from '@/entities/event';
import { createInvitations } from '@/entities/invitation/invitationsApi';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import styles from './ProfileInviteDialogs.module.css';

const SPAM_TEXT = 'Во избежание спама, в виде бесконтрольной рассылки приглашений, мы ограничили круг лиц, которым можно направлять приглашения, лишь списком ваших подписчиков.';

type InviteRole = 'организую' | 'участвую';

interface InviteEventRow {
  id: string;
  name: string;
  startTime: string;
  role: InviteRole;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function loadMyInviteEvents(accountId: string): Promise<InviteEventRow[]> {
  const now = new Date().toISOString();
  const base = {
    startTime: now,
    orderBy: 'StartTime',
    pageIndex: 0,
    pageSize: 100,
    active: true,
  };
  const [organized, participating] = await Promise.all([
    fetchEvents({ ...base, organizatorId: accountId }),
    fetchEvents({ ...base, participantId: accountId }),
  ]);
  const byId = new Map<string, InviteEventRow>();
  for (const event of organized.result ?? []) {
    byId.set(event.id, {
      id: event.id,
      name: event.name,
      startTime: event.startTime,
      role: 'организую',
    });
  }
  for (const event of participating.result ?? []) {
    if (byId.has(event.id)) continue;
    byId.set(event.id, {
      id: event.id,
      name: event.name,
      startTime: event.startTime,
      role: 'участвую',
    });
  }
  return [...byId.values()].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );
}

export function InviteSpamDialog({ onClose }: { onClose: () => void }) {
  useModalBackButton(onClose);

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.spam} role="dialog" aria-modal aria-labelledby="invite-spam-text">
        <p id="invite-spam-text" className={styles.spamText}>{SPAM_TEXT}</p>
        <div className={styles.spamActions}>
          <button type="button" className={styles.primaryBtn} onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </>,
    document.body,
  );
}

export function ProfileEventInviteModal({
  myAccountId,
  profileAccountId,
  onClose,
}: {
  myAccountId: string;
  profileAccountId: string;
  onClose: () => void;
}) {
  useModalBackButton(onClose);
  const [events, setEvents] = useState<InviteEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    loadMyInviteEvents(myAccountId)
      .then(rows => {
        if (!cancelled) setEvents(rows);
      })
      .catch(e => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить мероприятия');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [myAccountId]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleChoose = async () => {
    const ids = [...selected];
    if (ids.length === 0 || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await Promise.all(ids.map(eventId => createInvitations({
        accountIds: [profileAccountId],
        eventId,
        inviterAccountId: myAccountId,
      })));
      onClose();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Не удалось отправить приглашения');
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-label="Пригласить">
        <div className={styles.header}>
          <h3 className={styles.title}>Пригласить</h3>
        </div>
        <div className={styles.list}>
          {loading && <p className={styles.empty}>Загрузка…</p>}
          {!loading && loadError && <p className={styles.error}>{loadError}</p>}
          {!loading && !loadError && events.length === 0 && (
            <p className={styles.empty}>Нет предстоящих мероприятий</p>
          )}
          {!loading && !loadError && events.map(event => {
            const on = selected.has(event.id);
            return (
              <button
                key={event.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                className={`${styles.item} ${on ? styles.itemOn : ''}`}
                onClick={() => toggle(event.id)}
              >
                <span className={`${styles.box} ${on ? styles.boxOn : ''}`} aria-hidden>
                  {on && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  )}
                </span>
                <span className={styles.itemText}>
                  <span className={styles.itemName}>{event.name}</span>
                  <span className={styles.itemWhen}>{formatWhen(event.startTime)}</span>
                </span>
                <span className={styles.role}>{event.role}</span>
              </button>
            );
          })}
        </div>
        <div className={styles.footer}>
          {sendError && <span className={styles.footerError}>{sendError}</span>}
          <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={sending}>
            Отмена
          </button>
          <button
            type="button"
            className={styles.sendBtn}
            onClick={() => void handleChoose()}
            disabled={sending || selected.size === 0}
          >
            {sending ? 'Отправка…' : 'Выбрать'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
