// pages/my-tickets/MyTicketsPage.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createRefund,
  fetchMyTickets,
  transferTicket,
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const [giftAccountId, setGiftAccountId] = useState('');
  const [busy, setBusy] = useState(false);

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

  const closeAction = () => {
    if (busy) return;
    setActionTicket(null);
    setGiftAccountId('');
  };

  const confirmAction = async () => {
    if (!actionTicket || busy) return;
    const { ticket, action } = actionTicket;
    setBusy(true);
    try {
      if (action === 'refund') {
        await createRefund({
          orderId: ticket.orderId,
          ticketIds: [ticket.id],
          reason: 'Возврат пользователем из «Мои билеты»',
        });
        toast('Запрос на возврат отправлен', 'success');
      } else {
        const holderId = giftAccountId.trim();
        if (!UUID_RE.test(holderId)) {
          toast('Укажите UUID аккаунта получателя', 'error');
          return;
        }
        await transferTicket({
          ticketId: ticket.id,
          newHolderAccountId: holderId,
        });
        toast('Билет передан', 'success');
      }
      setActionTicket(null);
      setGiftAccountId('');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось выполнить действие', 'error');
    } finally {
      setBusy(false);
    }
  };

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
                        disabled={!canAct || busy}
                        title={canAct ? undefined : 'Доступно только для активных билетов'}
                        onClick={() => {
                          setGiftAccountId('');
                          setActionTicket({ ticket, action: 'gift' });
                        }}
                      >
                        Подарить
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={!canAct || busy}
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
              ? 'Будет создан возврат для этого билета. Статус обновится после подтверждения оплаты (stub/webhook).'
              : 'Укажите UUID аккаунта получателя. Владелец билета сменится, покупатель заказа останется прежним.'
          }
          confirmLabel={busy ? '…' : actionTicket.action === 'refund' ? 'Вернуть' : 'Передать'}
          cancelLabel="Отмена"
          variant={actionTicket.action === 'refund' ? 'danger' : 'accent'}
          onConfirm={() => { void confirmAction(); }}
          onCancel={closeAction}
        >
          {actionTicket.action === 'gift' && (
            <label className={styles.giftField}>
              <span>UUID получателя</span>
              <input
                value={giftAccountId}
                onChange={e => setGiftAccountId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                disabled={busy}
                autoComplete="off"
              />
            </label>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
