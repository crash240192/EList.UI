// pages/payments/PaymentsReturnPage.tsx
// Возврат после оплаты:
//   stub (?stub=1) → completePayment / completeWalletDeposit
//   T-Bank / внешний провайдер → ждём webhook на бэке, UI поллит статус заказа

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { completePayment, fetchOrderById, type OrderStatus } from '@/entities/order';
import { completeWalletDeposit } from '@/entities/user/walletApi';
import { usePageTitle } from '@/shared/hooks';
import { useToastStore } from '@/app/store';
import { Button } from '@/shared/ui/Button';
import styles from './PaymentsReturnPage.module.css';

const PENDING_ORDER_KEY = 'elist_pending_payment';
const PENDING_WALLET_KEY = 'elist_pending_wallet_deposit';

const ORDER_POLL_MS = 1500;
const ORDER_POLL_TIMEOUT_MS = 90_000;

const ORDER_SUCCESS: OrderStatus[] = ['Paid'];
const ORDER_FAILURE: OrderStatus[] = ['Canceled', 'Failed', 'Refunded'];

function sleep(ms: number) {
  return new Promise<void>(resolve => {
    window.setTimeout(resolve, ms);
  });
}

async function waitForOrderTerminal(
  orderId: string,
  onTick?: (status: OrderStatus | null) => void,
): Promise<'ok' | 'fail' | 'timeout'> {
  const deadline = Date.now() + ORDER_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const order = await fetchOrderById(orderId);
    const status = order?.status ?? null;
    onTick?.(status);
    if (status && ORDER_SUCCESS.includes(status)) return 'ok';
    if (status && ORDER_FAILURE.includes(status)) return 'fail';
    await sleep(ORDER_POLL_MS);
  }
  return 'timeout';
}

export default function PaymentsReturnPage() {
  usePageTitle('Оплата');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToastStore(s => s.add);
  const started = useRef(false);

  const [phase, setPhase] = useState<'working' | 'ok' | 'error'>('working');
  const [message, setMessage] = useState('Подтверждаем оплату…');
  const [kind, setKind] = useState<'order' | 'wallet'>('order');

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      const purpose = params.get('purpose');
      const isStub = params.get('stub') === '1';
      let depositId = params.get('depositId') || undefined;
      let orderId = params.get('orderId') || undefined;
      let providerPaymentId = params.get('paymentId') || params.get('providerPaymentId') || undefined;

      const isWallet = purpose === 'wallet' || Boolean(depositId);

      if (isWallet) {
        setKind('wallet');
        if (!depositId && !providerPaymentId) {
          try {
            const raw = sessionStorage.getItem(PENDING_WALLET_KEY);
            if (raw) {
              const pending = JSON.parse(raw) as {
                depositId?: string;
                providerPaymentId?: string | null;
              };
              depositId = depositId || pending.depositId;
              providerPaymentId = providerPaymentId || pending.providerPaymentId || undefined;
            }
          } catch { /* ignore */ }
        }

        if (!depositId && !providerPaymentId) {
          setPhase('error');
          setMessage('Не найдено пополнение для подтверждения оплаты');
          return;
        }

        // Реальный T-Bank: ручной complete недоступен; wallet webhook ещё не готов.
        if (!isStub) {
          setPhase('error');
          setMessage(
            'Пополнение через платёжную форму пока подтверждается только на стороне банка. '
            + 'Если деньги списались, обновите кошелёк чуть позже или обратитесь в поддержку.',
          );
          return;
        }

        try {
          await completeWalletDeposit({ depositId, providerPaymentId });
          try { sessionStorage.removeItem(PENDING_WALLET_KEY); } catch { /* ignore */ }
          setPhase('ok');
          setMessage('Баланс тарифного кошелька пополнен.');
          toast('Пополнение подтверждено', 'success');
        } catch (e) {
          setPhase('error');
          setMessage(e instanceof Error ? e.message : 'Не удалось подтвердить пополнение');
        }
        return;
      }

      if (!orderId && !providerPaymentId) {
        try {
          const raw = sessionStorage.getItem(PENDING_ORDER_KEY);
          if (raw) {
            const pending = JSON.parse(raw) as {
              orderId?: string;
              providerPaymentId?: string | null;
            };
            orderId = orderId || pending.orderId;
            providerPaymentId = providerPaymentId || pending.providerPaymentId || undefined;
          }
        } catch { /* ignore */ }
      }

      if (!orderId && !providerPaymentId) {
        setPhase('error');
        setMessage('Не найден заказ для подтверждения оплаты');
        return;
      }

      // Stub ЮKassa: фронт сам завершает оплату.
      if (isStub) {
        try {
          await completePayment({ orderId, providerPaymentId });
          try { sessionStorage.removeItem(PENDING_ORDER_KEY); } catch { /* ignore */ }
          setPhase('ok');
          setMessage('Оплата прошла успешно. Билет уже в разделе «Мои билеты».');
          toast('Оплата подтверждена', 'success');
        } catch (e) {
          setPhase('error');
          setMessage(e instanceof Error ? e.message : 'Не удалось подтвердить оплату');
        }
        return;
      }

      // T-Bank / внешний провайдер: билеты выдаёт webhook; UI ждёт Paid.
      if (!orderId) {
        setPhase('error');
        setMessage('Не найден orderId для проверки статуса оплаты');
        return;
      }

      setMessage('Ожидаем подтверждение оплаты от банка…');
      const result = await waitForOrderTerminal(orderId, status => {
        if (status === 'Pending' || status === 'Authorized') {
          setMessage('Ожидаем подтверждение оплаты от банка…');
        }
      });

      if (result === 'ok') {
        try { sessionStorage.removeItem(PENDING_ORDER_KEY); } catch { /* ignore */ }
        setPhase('ok');
        setMessage('Оплата прошла успешно. Билет уже в разделе «Мои билеты».');
        toast('Оплата подтверждена', 'success');
        return;
      }

      if (result === 'fail') {
        setPhase('error');
        setMessage('Оплата не прошла или была отменена.');
        return;
      }

      setPhase('error');
      setMessage(
        'Не дождались подтверждения оплаты. Если списание прошло, билет появится в «Мои билеты» '
        + 'после уведомления от банка — обновите страницу чуть позже.',
      );
    })();
  }, [params, toast]);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>
          {phase === 'working' ? 'Оплата' : phase === 'ok' ? 'Готово' : 'Ошибка оплаты'}
        </h1>
        <p className={styles.text}>{message}</p>
        <div className={styles.actions}>
          {phase !== 'working' && (
            <>
              <Button
                onClick={() => navigate(kind === 'wallet' ? '/wallet' : '/my-tickets', { replace: true })}
              >
                {kind === 'wallet' ? 'В кошелёк' : 'Мои билеты'}
              </Button>
              <Button variant="secondary" onClick={() => navigate('/', { replace: true })}>
                На главную
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
