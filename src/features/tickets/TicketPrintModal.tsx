// features/tickets/TicketPrintModal.tsx — превью + window.print (W6d)

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchEventById } from '@/entities/event';
import type { ITicket } from '@/entities/order';
import { Button } from '@/shared/ui/Button';
import {
  TicketPrintLayout,
  type TicketPrintData,
} from './TicketPrintLayout';
import modalStyles from './TicketPrintModal.module.css';

interface TicketPrintModalProps {
  ticket: ITicket;
  eventNameHint?: string | null;
  price?: number | null;
  currency?: string | null;
  onClose: () => void;
}

export function TicketPrintModal({
  ticket,
  eventNameHint,
  price,
  currency,
  onClose,
}: TicketPrintModalProps) {
  const [data, setData] = useState<TicketPrintData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const ev = await fetchEventById(ticket.eventId);
        if (cancelled) return;
        setData({
          eventName: ev?.name || eventNameHint || 'Мероприятие',
          startTime: ev?.startTime ?? null,
          endTime: ev?.endTime ?? null,
          address: ev?.address ?? null,
          ticketTypeName: ticket.ticketTypeName,
          price: price ?? null,
          currency: currency ?? 'RUB',
          code: ticket.code,
          orderId: ticket.orderId,
        });
      } catch (e) {
        if (cancelled) return;
        if (eventNameHint && ticket.code) {
          setData({
            eventName: eventNameHint,
            ticketTypeName: ticket.ticketTypeName,
            price: price ?? null,
            currency: currency ?? 'RUB',
            code: ticket.code,
            orderId: ticket.orderId,
          });
        } else {
          setError(e instanceof Error ? e.message : 'Не удалось подготовить билет');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ticket, eventNameHint, price, currency]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handlePrint = () => {
    const root = document.getElementById('ticket-print-root');
    const img = root?.querySelector('img');
    if (img?.complete) {
      window.print();
      return;
    }
    // QR рисуется async — подождать кадр/картинку
    window.setTimeout(() => window.print(), 300);
  };

  return createPortal(
    <div
      className={modalStyles.host}
      data-ticket-print-host
      role="dialog"
      aria-modal="true"
      aria-label="Печать билета"
    >
      <div className={`${modalStyles.backdrop} previewChrome`} onClick={onClose} />
      <div className={modalStyles.panel}>
        <div className={`${modalStyles.chrome} previewChrome`}>
          <div className={modalStyles.chromeTitle}>Печать билета</div>
          <p className={modalStyles.chromeHint}>
            В диалоге можно выбрать принтер или «Сохранить как PDF».
          </p>
          <div className={modalStyles.chromeActions}>
            <Button
              size="sm"
              disabled={loading || !data}
              onClick={handlePrint}
            >
              Печать
            </Button>
            <Button size="sm" variant="secondary" onClick={onClose}>
              Закрыть
            </Button>
          </div>
          {loading && <p className={modalStyles.status}>Подготовка…</p>}
          {error && <p className={modalStyles.error}>{error}</p>}
        </div>
        {data && <TicketPrintLayout data={data} />}
      </div>
    </div>,
    document.body,
  );
}
