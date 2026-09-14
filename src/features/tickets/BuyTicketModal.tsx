// features/tickets/BuyTicketModal.tsx

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  createOrder,
  formatMoney,
  type IOrder,
} from '@/entities/order';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { Button } from '@/shared/ui/Button';
import { PaymentStubModal } from './PaymentStubModal';
import styles from './BuyTicketModal.module.css';

interface BuyTicketModalProps {
  open: boolean;
  eventId: string;
  eventName: string;
  unitPrice: number;
  /** Сколько ещё можно купить с учётом лимита мест; null = без лимита */
  remainingSeats: number | null;
  onClose: () => void;
  onPurchased: (order: IOrder) => void;
}

export function BuyTicketModal({
  open,
  eventId,
  eventName,
  unitPrice,
  remainingSeats,
  onClose,
  onPurchased,
}: BuyTicketModalProps) {
  const maxQty = remainingSeats == null
    ? 10
    : Math.max(0, Math.min(10, remainingSeats));
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPay, setPendingPay] = useState<{
    orderId: string;
    providerPaymentId: string | null;
    amountTotal: number;
    currency: string;
  } | null>(null);

  useModalBackButton(() => {
    if (!busy && !pendingPay) onClose();
  }, open && !pendingPay);

  const total = useMemo(() => unitPrice * qty, [unitPrice, qty]);

  if (!open) return null;

  const soldOut = maxQty <= 0;

  const handleSubmit = async () => {
    if (soldOut || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createOrder({
        eventId,
        quantity: qty,
      });
      if (result.paidImmediately) {
        onPurchased(result.order);
        onClose();
        return;
      }

      const pending = {
        orderId: result.order.id,
        providerPaymentId: result.providerPaymentId,
        amountTotal: result.order.amountTotal || total,
        currency: result.order.currency || 'RUB',
      };

      // Сохраняем для /payments/return (реальный провайдер / stub returnUrl).
      try {
        sessionStorage.setItem('elist_pending_payment', JSON.stringify(pending));
      } catch { /* ignore */ }

      const confirmationUrl = result.confirmationUrl?.trim() || null;
      if (confirmationUrl) {
        let useInAppStub = false;
        try {
          const url = new URL(confirmationUrl, window.location.origin);
          useInAppStub = url.searchParams.get('stub') === '1'
            || url.pathname.includes('/payments/return');
        } catch {
          useInAppStub = false;
        }
        if (!useInAppStub) {
          window.location.assign(confirmationUrl);
          return;
        }
      }

      // Stub / локальный return: виджет-заглушка с completePayment.
      setPendingPay(pending);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать заказ');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <>
      {!pendingPay && (
        <>
          <div className={styles.backdrop} onClick={busy ? undefined : onClose} aria-hidden />
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="buy-ticket-title"
          >
            <p id="buy-ticket-title" className={styles.title}>Купить билет</p>
            <p className={styles.eventName}>{eventName}</p>

            <div className={styles.row}>
              <span className={styles.rowLabel}>Билет</span>
              <span className={styles.rowValue}>
                {unitPrice <= 0 ? 'Бесплатно' : formatMoney(unitPrice)}
              </span>
            </div>

            <div className={styles.row}>
              <span className={styles.rowLabel}>Количество</span>
              <div className={styles.qty}>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  disabled={busy || qty <= 1}
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  aria-label="Меньше"
                >
                  −
                </button>
                <span className={styles.qtyValue}>{qty}</span>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  disabled={busy || qty >= maxQty}
                  onClick={() => setQty(q => Math.min(maxQty, q + 1))}
                  aria-label="Больше"
                >
                  +
                </button>
              </div>
            </div>

            {remainingSeats != null && (
              <p className={styles.hint}>
                {soldOut
                  ? 'Мест больше нет'
                  : `Доступно мест: ${remainingSeats}`}
              </p>
            )}

            <div className={styles.totalRow}>
              <span>Итого</span>
              <strong>{unitPrice <= 0 ? 'Бесплатно' : formatMoney(total)}</strong>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={busy}>
                Отмена
              </button>
              <Button
                onClick={() => { void handleSubmit(); }}
                loading={busy}
                disabled={soldOut}
              >
                {unitPrice <= 0 ? 'Получить билет' : 'Оформить покупку'}
              </Button>
            </div>
          </div>
        </>
      )}

      {pendingPay && (
        <PaymentStubModal
          open
          orderId={pendingPay.orderId}
          providerPaymentId={pendingPay.providerPaymentId}
          amountLabel={formatMoney(pendingPay.amountTotal, pendingPay.currency)}
          onPaid={(order) => {
            onPurchased(order);
          }}
          onClose={() => {
            setPendingPay(null);
            onClose();
          }}
        />
      )}
    </>,
    document.body,
  );
}
