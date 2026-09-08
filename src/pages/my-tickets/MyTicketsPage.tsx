// pages/my-tickets/MyTicketsPage.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchMyTickets,
  TICKET_STATUS_LABELS,
  type ITicket,
  type TicketStatus,
} from '@/entities/order';
import { fetchEventById } from '@/entities/event';
import { usePageTitle } from '@/shared/hooks';
import { useToastStore } from '@/app/store';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { Button } from '@/shared/ui/Button';
import styles from './MyTicketsPage.module.css';

interface TicketRow extends ITicket {
  eventName: string | null;
}

const STATUS_CLASS: Partial<Record<TicketStatus, string>> = {
  Issued: styles.statusIssued,
  Used: styles.statusUsed,
  Refunded: styles.statusRefunded,
  Void: styles.statusVoid,
};

export default function MyTicketsPage() {
  usePageTitle('Мои билеты');
  const navigate = useNavigate();
  const toast = useToastStore(s => s.add);

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionTicket, setActionTicket] = useState<{
    ticket: TicketRow;
    action: 'refund' | 'gift';
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchMyTickets();
      const eventIds = [...new Set(list.map(t => t.eventId).filter(Boolean))];
      const nameById = new Map<string, string>();
      await Promise.all(eventIds.map(async (eventId) => {
        try {
          const ev = await fetchEventById(eventId);
          if (ev?.name) nameById.set(eventId, ev.name);
        } catch {
          /* ignore */
        }
      }));
      setTickets(list.map(t => ({
        ...t,
        eventName: nameById.get(t.eventId) ?? null,
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить билеты');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(
    () => [...tickets].sort((a, b) => {
      const ta = a.issuedAt ? new Date(a.issuedAt).getTime() : 0;
      const tb = b.issuedAt ? new Date(b.issuedAt).getTime() : 0;
      return tb - ta;
    }),
    [tickets],
  );

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.head}>
          <h1 className={styles.title}>Мои билеты</h1>
          <p className={styles.subtitle}>Купленные билеты, статус и действия</p>
        </div>

        <div className={styles.body}>
          {loading && <div className={styles.state}>Загрузка…</div>}
          {!loading && error && <div className={styles.error}>{error}</div>}
          {!loading && !error && sorted.length === 0 && (
            <div className={styles.state}>
              Пока нет билетов. Купите билет на странице мероприятия.
            </div>
          )}

          {!loading && !error && sorted.length > 0 && (
            <ul className={styles.list}>
              {sorted.map(ticket => {
                const canAct = ticket.status === 'Issued';
                const issued = ticket.issuedAt
                  ? new Date(ticket.issuedAt).toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  : null;
                return (
                  <li key={ticket.id} className={styles.item}>
                    <div className={styles.itemMain}>
                      <button
                        type="button"
                        className={styles.eventBtn}
                        onClick={() => navigate(`/event/${ticket.eventId}`)}
                      >
                        {ticket.eventName || 'Мероприятие'}
                      </button>
                      <div className={styles.meta}>
                        <span
                          className={`${styles.status} ${STATUS_CLASS[ticket.status] ?? ''}`}
                        >
                          {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                        </span>
                        {issued && <span className={styles.metaText}>{issued}</span>}
                      </div>
                      {ticket.code && (
                        <div className={styles.code}>Код: {ticket.code}</div>
                      )}
                    </div>
                    <div className={styles.actions}>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!canAct}
                        title={canAct ? undefined : 'Доступно только для активных билетов'}
                        onClick={() => setActionTicket({ ticket, action: 'gift' })}
                      >
                        Подарить
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={!canAct}
                        title={canAct ? undefined : 'Доступно только для активных билетов'}
                        onClick={() => setActionTicket({ ticket, action: 'refund' })}
                      >
                        Вернуть
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {actionTicket && (
        <ConfirmDialog
          title={
            actionTicket.action === 'refund'
              ? 'Вернуть билет?'
              : 'Подарить билет?'
          }
          message={
            actionTicket.action === 'refund'
              ? 'Возврат билетов скоро будет доступен. API возврата пока не подключено.'
              : 'Передача билета другому пользователю скоро будет доступна.'
          }
          confirmLabel="Понятно"
          hideCancel
          variant="accent"
          onConfirm={() => {
            toast(
              actionTicket.action === 'refund'
                ? 'Возврат билетов появится позже'
                : 'Передача билетов появится позже',
              'info',
            );
            setActionTicket(null);
          }}
          onCancel={() => setActionTicket(null)}
        />
      )}
    </div>
  );
}
