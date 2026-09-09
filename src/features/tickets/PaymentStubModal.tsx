// features/tickets/PaymentStubModal.tsx
// Заглушка виджета ЮKassa: таймер 5 с → payments/complete → экран успеха

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { completePayment, type IOrder } from '@/entities/order';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { Button } from '@/shared/ui/Button';
import styles from './PaymentStubModal.module.css';

const STUB_SECONDS = 5;

type Phase = 'countdown' | 'completing' | 'success' | 'error';

interface PaymentStubModalProps {
  open: boolean;
  orderId: string;
  providerPaymentId: string | null;
  amountLabel: string;
  /** Вызывается после успешного complete (без автозакрытия модалки) */
  onPaid: (order: IOrder) => void;
  onClose: () => void;
}

export function PaymentStubModal({
  open,
  orderId,
  providerPaymentId,
  amountLabel,
  onPaid,
  onClose,
}: PaymentStubModalProps) {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(STUB_SECONDS);
  const [phase, setPhase] = useState<Phase>('countdown');
  const [error, setError] = useState<string | null>(null);
  const completeStartedRef = useRef(false);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  const canDismiss = phase === 'success' || phase === 'error' || phase === 'countdown';

  useModalBackButton(() => {
    if (canDismiss && phase !== 'completing') onClose();
  }, open);

  useEffect(() => {
    if (!open) return;
    setSecondsLeft(STUB_SECONDS);
    setPhase('countdown');
    setError(null);
    completeStartedRef.current = false;
  }, [open, orderId]);

  // Таймер
  useEffect(() => {
    if (!open || phase !== 'countdown') return;
    if (secondsLeft <= 0) return;
    const t = window.setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [open, phase, secondsLeft]);

  // После таймера — complete (без отмены через cleanup при смене phase)
  useEffect(() => {
    if (!open || phase !== 'countdown' || secondsLeft > 0) return;
    if (completeStartedRef.current) return;
    completeStartedRef.current = true;
    setPhase('completing');

    void (async () => {
      try {
        const order = await completePayment({
          orderId,
          ...(providerPaymentId ? { providerPaymentId } : {}),
        });
        setPhase('success');
        onPaidRef.current(order);
      } catch (e) {
        completeStartedRef.current = false;
        setError(e instanceof Error ? e.message : 'Не удалось подтвердить оплату');
        setPhase('error');
      }
    })();
  }, [open, phase, secondsLeft, orderId, providerPaymentId]);

  if (!open) return null;

  const progress = ((STUB_SECONDS - Math.max(secondsLeft, 0)) / STUB_SECONDS) * 100;

  return createPortal(
    <>
      <div
        className={styles.backdrop}
        onClick={phase === 'success' || phase === 'error' ? onClose : undefined}
        aria-hidden
      />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-stub-title"
      >
        {phase === 'success' ? (
          <>
            <p id="payment-stub-title" className={styles.title}>Оплата прошла успешно</p>
            <p className={styles.subtitle}>
              Билет оформлен. Вы можете посмотреть его в разделе «Мои билеты».
            </p>
            <div className={styles.amount}>{amountLabel}</div>
            <div className={styles.successMark} aria-hidden>✓</div>
            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>
                Закрыть
              </button>
              <Button
                onClick={() => {
                  onClose();
                  navigate('/my-tickets');
                }}
              >
                Мои билеты
              </Button>
            </div>
          </>
        ) : (
          <>
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
                  {phase === 'completing' ? '…' : Math.max(secondsLeft, 0)}
                </span>
              </div>
              <p className={styles.timerHint}>
                {phase === 'error'
                  ? error
                  : phase === 'completing'
                    ? 'Подтверждаем оплату…'
                    : `Осталось ${secondsLeft} с`}
              </p>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onClose}
                disabled={phase === 'completing'}
              >
                Отмена
              </button>
              {phase === 'error' && (
                <button
                  type="button"
                  className={styles.retryBtn}
                  onClick={() => {
                    setError(null);
                    setPhase('countdown');
                    setSecondsLeft(0);
                    completeStartedRef.current = false;
                  }}
                >
                  Повторить
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>,
    document.body,
  );
}
