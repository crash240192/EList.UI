// features/tickets/PaymentStubModal.tsx
// Заглушка виджета ЮKassa: визуальный таймер 5 с, затем payments/complete

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { completePayment, type IOrder } from '@/entities/order';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import styles from './PaymentStubModal.module.css';

const STUB_SECONDS = 5;

interface PaymentStubModalProps {
  open: boolean;
  orderId: string;
  providerPaymentId: string | null;
  amountLabel: string;
  onSuccess: (order: IOrder) => void;
  onCancel: () => void;
}

export function PaymentStubModal({
  open,
  orderId,
  providerPaymentId,
  amountLabel,
  onSuccess,
  onCancel,
}: PaymentStubModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(STUB_SECONDS);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalBackButton(() => {
    if (!completing) onCancel();
  }, open);

  useEffect(() => {
    if (!open) return;
    setSecondsLeft(STUB_SECONDS);
    setCompleting(false);
    setError(null);
  }, [open, orderId]);

  useEffect(() => {
    if (!open || completing || error) return;
    if (secondsLeft <= 0) return;

    const t = window.setTimeout(() => {
      setSecondsLeft(s => s - 1);
    }, 1000);
    return () => window.clearTimeout(t);
  }, [open, secondsLeft, completing, error]);

  useEffect(() => {
    if (!open || completing || error) return;
    if (secondsLeft > 0) return;

    let cancelled = false;
    setCompleting(true);
    (async () => {
      try {
        const order = await completePayment({
          orderId,
          ...(providerPaymentId ? { providerPaymentId } : {}),
        });
        if (!cancelled) onSuccess(order);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Не удалось подтвердить оплату');
          setCompleting(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [open, secondsLeft, completing, error, orderId, providerPaymentId, onSuccess]);

  if (!open) return null;

  const progress = ((STUB_SECONDS - secondsLeft) / STUB_SECONDS) * 100;

  return createPortal(
    <>
      <div className={styles.backdrop} aria-hidden />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-stub-title"
      >
        <p id="payment-stub-title" className={styles.title}>Оплата билета</p>
        <p className={styles.subtitle}>
          Заглушка виджета ЮKassa. Через {STUB_SECONDS} с оплата будет подтверждена автоматически.
        </p>
        <div className={styles.amount}>{amountLabel}</div>

        <div className={styles.timerWrap} aria-live="polite">
          <div className={styles.timerRing}>
            <svg viewBox="0 0 96 96" className={styles.timerSvg} aria-hidden>
              <circle cx="48" cy="48" r="40" className={styles.timerTrack} />
              <circle
                cx="48"
                cy="48"
                r="40"
                className={styles.timerProgress}
                style={{
                  strokeDasharray: `${2 * Math.PI * 40}`,
                  strokeDashoffset: `${2 * Math.PI * 40 * (1 - progress / 100)}`,
                }}
              />
            </svg>
            <span className={styles.timerValue}>
              {completing ? '…' : Math.max(secondsLeft, 0)}
            </span>
          </div>
          <p className={styles.timerHint}>
            {error
              ? error
              : completing
                ? 'Подтверждаем оплату…'
                : `Осталось ${secondsLeft} с`}
          </p>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={completing}
          >
            Отмена
          </button>
          {error && (
            <button
              type="button"
              className={styles.retryBtn}
              onClick={() => {
                setError(null);
                setSecondsLeft(0);
              }}
            >
              Повторить
            </button>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
