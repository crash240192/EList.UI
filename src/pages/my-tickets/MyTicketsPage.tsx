// pages/my-tickets/MyTicketsPage.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  cancelRefund,
  createRefund,
  fetchMyTickets,
  fetchRefundsByOrder,
  transferTicket,
  TICKET_STATUS_LABELS,
  type ITicket,
  type TicketStatus,
} from '@/entities/order';
import { fetchEventById } from '@/entities/event';
import { useAccountId } from '@/features/auth/useAccountId';
import { usePageTitle } from '@/shared/hooks';
import { useToastStore } from '@/app/store';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { Button } from '@/shared/ui/Button';
import { GiftRecipientModal } from './GiftRecipientModal';
import styles from './MyTicketsPage.module.css';

interface TicketRow extends ITicket {
  eventName: string | null;
}

const STATUS_CLASS: Partial<Record<TicketStatus, string>> = {
  Issued: styles.statusIssued,
  Used: styles.statusUsed,
  Refunded: styles.statusRefunded,
  Void: styles.statusVoid,
  RefundPending: styles.statusRefundPending,
};

export default function MyTicketsPage() {
  usePageTitle('Мои билеты');
  const navigate = useNavigate();
  const toast = useToastStore(s => s.add);
  const { accountId } = useAccountId();

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refundTicket, setRefundTicket] = useState<TicketRow | null>(null);
  const [cancelTicket, setCancelTicket] = useState<TicketRow | null>(null);
  const [giftTicket, setGiftTicket] = useState<TicketRow | null>(null);
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

  const confirmRefund = async () => {
    if (!refundTicket || busy) return;
    setBusy(true);
    try {
      await createRefund({
        orderId: refundTicket.orderId,
        ticketIds: [refundTicket.id],
        reason: 'Возврат пользователем из «Мои билеты»',
      });
      toast('Заявка на возврат создана', 'success');
      setRefundTicket(null);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось создать возврат', 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmCancelRefund = async () => {
    if (!cancelTicket || busy) return;
    setBusy(true);
    try {
      const refunds = await fetchRefundsByOrder(cancelTicket.orderId);
      const pending = refunds.find(r =>
        r.status === 'Pending'
        && (r.ticketIds.length === 0 || r.ticketIds.includes(cancelTicket.id)),
      );
      if (!pending) {
        toast('Активная заявка на возврат не найдена', 'error');
        return;
      }
      await cancelRefund({ refundId: pending.id });
      toast('Заявка на возврат отменена', 'success');
      setCancelTicket(null);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось отменить возврат', 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmGift = async (recipientId: string, label: string) => {
    if (!giftTicket || busy) return;
    setBusy(true);
    try {
      await transferTicket({
        ticketId: giftTicket.id,
        newHolderAccountId: recipientId,
      });
      toast(`Билет передан: ${label}`, 'success');
      setGiftTicket(null);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось передать билет', 'error');
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
                const canCancelRefund = ticket.status === 'RefundPending';
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
                      {canCancelRefund ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => setCancelTicket(ticket)}
                        >
                          Отменить возврат
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!canAct || busy || !accountId}
                            title={canAct ? undefined : 'Доступно только для активных билетов'}
                            onClick={() => setGiftTicket(ticket)}
                          >
                            Подарить
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={!canAct || busy}
                            title={canAct ? undefined : 'Доступно только для активных билетов'}
                            onClick={() => setRefundTicket(ticket)}
                          >
                            Вернуть
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {refundTicket && (
        <ConfirmDialog
          title="Вернуть билет?"
          message="Будет создана заявка на возврат. Билет перейдёт в статус «Заявка на возврат» до подтверждения оплаты (stub/webhook)."
          confirmLabel={busy ? '…' : 'Вернуть'}
          cancelLabel="Отмена"
          variant="danger"
          onConfirm={() => { void confirmRefund(); }}
          onCancel={() => { if (!busy) setRefundTicket(null); }}
        />
      )}

      {cancelTicket && (
        <ConfirmDialog
          title="Отменить заявку на возврат?"
          message="Билет снова станет активным. Заявку можно подать повторно позже."
          confirmLabel={busy ? '…' : 'Отменить заявку'}
          cancelLabel="Закрыть"
          variant="accent"
          onConfirm={() => { void confirmCancelRefund(); }}
          onCancel={() => { if (!busy) setCancelTicket(null); }}
        />
      )}

      {giftTicket && accountId && (
        <GiftRecipientModal
          currentAccountId={accountId}
          busy={busy}
          onClose={() => { if (!busy) setGiftTicket(null); }}
          onConfirm={(id, label) => { void confirmGift(id, label); }}
        />
      )}
    </div>
  );
}
