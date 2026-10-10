// features/tickets/BuyTicketModal.tsx

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  createOrder,
  formatMoney,
  type IOrder,
} from '@/entities/order';
import {
  fetchEventTicketTypes,
  type IEventTicketType,
} from '@/entities/event/ticketTypesApi';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { Button } from '@/shared/ui/Button';
import { PaymentStubModal } from './PaymentStubModal';
import styles from './BuyTicketModal.module.css';

interface BuyTicketModalProps {
  open: boolean;
  eventId: string;
  eventName: string;
  /** Fallback цена, если типы ещё не загрузились / один тип без выбора. */
  unitPrice: number;
  /** Сколько ещё можно купить с учётом лимита мест; null = без лимита */
  remainingSeats: number | null;
  /** Покупатель уже участник — билеты для подарка/докупки */
  giftMode?: boolean;
  onClose: () => void;
  onPurchased: (order: IOrder) => void;
}

export function BuyTicketModal({
  open,
  eventId,
  eventName,
  unitPrice,
  remainingSeats,
  giftMode = false,
  onClose,
  onPurchased,
}: BuyTicketModalProps) {
  const [types, setTypes] = useState<IEventTicketType[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setTypesLoading(true);
    setError(null);
    setQty(1);
    setSelectedTypeId(null);
    fetchEventTicketTypes(eventId, false)
      .then(list => {
        if (cancelled) return;
        const active = list.filter(t => t.active).sort((a, b) => a.sortOrder - b.sortOrder);
        setTypes(active);
        if (active.length > 0) setSelectedTypeId(active[0].id);
      })
      .catch(() => {
        if (!cancelled) setTypes([]);
      })
      .finally(() => {
        if (!cancelled) setTypesLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, eventId]);

  const selectedType = useMemo(
    () => types.find(t => t.id === selectedTypeId) ?? null,
    [types, selectedTypeId],
  );

  const effectiveUnitPrice = selectedType != null ? selectedType.price : unitPrice;

  const typeRemaining = selectedType?.capacity != null && selectedType.capacity > 0
    ? selectedType.capacity
    : null;

  const effectiveRemaining = (() => {
    if (remainingSeats == null && typeRemaining == null) return null;
    if (remainingSeats == null) return typeRemaining;
    if (typeRemaining == null) return remainingSeats;
    return Math.min(remainingSeats, typeRemaining);
  })();

  const maxQty = effectiveRemaining == null
    ? 10
    : Math.max(0, Math.min(10, effectiveRemaining));

  const total = useMemo(() => effectiveUnitPrice * qty, [effectiveUnitPrice, qty]);

  useEffect(() => {
    if (qty > maxQty && maxQty > 0) setQty(maxQty);
  }, [maxQty, qty]);

  if (!open) return null;

  const soldOut = maxQty <= 0;
  const needsType = types.length > 1;
  const typeMissing = types.length > 0 && !selectedTypeId;

  const handleSubmit = async () => {
    if (soldOut || busy || typeMissing) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createOrder({
        eventId,
        quantity: qty,
        ...(selectedTypeId ? { ticketTypeId: selectedTypeId } : {}),
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
            <p id="buy-ticket-title" className={styles.title}>
              {giftMode ? 'Купить билет в подарок' : 'Купить билет'}
            </p>
            <p className={styles.eventName}>{eventName}</p>
            {giftMode && (
              <p className={styles.eventName} style={{ opacity: 0.85, fontSize: 13 }}>
                Билеты появятся в «Мои билеты» — передайте получателю через «Подарить».
              </p>
            )}

            {typesLoading && (
              <p className={styles.hint}>Загрузка типов билетов…</p>
            )}

            {!typesLoading && types.length > 1 && (
              <div className={styles.typeList} role="radiogroup" aria-label="Тип билета">
                {types.map(t => {
                  const selected = t.id === selectedTypeId;
                  return (
                    <label
                      key={t.id}
                      className={`${styles.typeOption} ${selected ? styles.typeOptionActive : ''}`}
                    >
                      <input
                        type="radio"
                        name="ticket-type"
                        checked={selected}
                        onChange={() => {
                          setSelectedTypeId(t.id);
                          setQty(1);
                        }}
                      />
                      <span className={styles.typeMeta}>
                        <span className={styles.typeName}>{t.name}</span>
                        {t.capacity != null && (
                          <span className={styles.typeCap}>до {t.capacity} мест</span>
                        )}
                      </span>
                      <span className={styles.typePrice}>
                        {t.price <= 0 ? 'Бесплатно' : formatMoney(t.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {!typesLoading && types.length <= 1 && (
              <div className={styles.row}>
                <span className={styles.rowLabel}>
                  {selectedType?.name || 'Билет'}
                </span>
                <span className={styles.rowValue}>
                  {effectiveUnitPrice <= 0 ? 'Бесплатно' : formatMoney(effectiveUnitPrice)}
                </span>
              </div>
            )}

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

            {effectiveRemaining != null && (
              <p className={styles.hint}>
                {soldOut
                  ? 'Мест больше нет'
                  : `Доступно мест: ${effectiveRemaining}`}
              </p>
            )}

            <div className={styles.totalRow}>
              <span>Итого</span>
              <strong>{effectiveUnitPrice <= 0 ? 'Бесплатно' : formatMoney(total)}</strong>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={busy}>
                Отмена
              </button>
              <Button
                onClick={() => { void handleSubmit(); }}
                loading={busy || typesLoading}
                disabled={soldOut || typeMissing || (needsType && !selectedTypeId)}
              >
                {effectiveUnitPrice <= 0 ? 'Получить билет' : 'Оформить покупку'}
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
