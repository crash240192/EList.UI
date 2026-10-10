// pages/payments/PaymentsReturnPage.tsx
// Возврат после оплаты:
//   stub (?stub=1) → completePayment / completeWalletDeposit
//   T-Bank / внешний провайдер → UI поллит статус; бэкенд на GET
//   дополнительно дергает GetState (P4), если webhook ещё не пришёл

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { completePayment, fetchOrderById, type OrderStatus } from '@/entities/order';
import {
  completeWalletDeposit,
  fetchWalletDeposit,
  type WalletDepositStatus,
} from '@/entities/user/walletApi';
import { usePageTitle } from '@/shared/hooks';
import { useToastStore } from '@/app/store';
import { Button } from '@/shared/ui/Button';
import styles from './PaymentsReturnPage.module.css';

const PENDING_ORDER_KEY = 'elist_pending_payment';
const PENDING_WALLET_KEY = 'elist_pending_wallet_deposit';

const POLL_MS = 1500;
const POLL_TIMEOUT_MS = 90_000;

const ORDER_SUCCESS: OrderStatus[] = ['Paid'];
const ORDER_FAILURE: OrderStatus[] = ['Canceled', 'Failed', 'Refunded'];

const WALLET_SUCCESS: WalletDepositStatus[] = ['Succeeded'];
const WALLET_FAILURE: WalletDepositStatus[] = ['Canceled', 'Failed'];

type PendingOrder = {
  orderId?: string;
  providerPaymentId?: string | null;
};

type PendingWallet = {
  depositId?: string;
  walletId?: string;
  providerPaymentId?: string | null;
};

function sleep(ms: number) {
  return new Promise<void>(resolve => {
    window.setTimeout(resolve, ms);
  });
}

function readPending<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function waitForOrderTerminal(
  orderId: string,
  onTick?: (status: OrderStatus | null) => void,
): Promise<'ok' | 'fail' | 'timeout'> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const order = await fetchOrderById(orderId);
    const status = order?.status ?? null;
    onTick?.(status);
    if (status && ORDER_SUCCESS.includes(status)) return 'ok';
    if (status && ORDER_FAILURE.includes(status)) return 'fail';
    await sleep(POLL_MS);
  }
  return 'timeout';
}

async function waitForWalletDepositTerminal(
  params: { walletId?: string; depositId?: string; providerPaymentId?: string },
  onTick?: (status: WalletDepositStatus | null) => void,
): Promise<'ok' | 'fail' | 'timeout'> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const deposit = await fetchWalletDeposit(params);
    const status = deposit?.status ?? null;
    onTick?.(status);
    if (status && WALLET_SUCCESS.includes(status)) return 'ok';
    if (status && WALLET_FAILURE.includes(status)) return 'fail';
    await sleep(POLL_MS);
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
      let walletId: string | undefined;

      const pendingWallet = readPending<PendingWallet>(PENDING_WALLET_KEY);
      const pendingOrder = readPending<PendingOrder>(PENDING_ORDER_KEY);

      // T-Bank SuccessURL часто без query — восстанавливаем из sessionStorage.
      // P3: SuccessURL уже несёт depositId/orderId/purpose — sessionStorage остаётся fallback.
      if (!depositId && pendingWallet?.depositId) depositId = pendingWallet.depositId;
      if (!walletId && pendingWallet?.walletId) walletId = pendingWallet.walletId;
      if (!providerPaymentId && pendingWallet?.providerPaymentId) {
        providerPaymentId = pendingWallet.providerPaymentId || undefined;
      }
      if (!orderId && pendingOrder?.orderId) orderId = pendingOrder.orderId;
      if (!providerPaymentId && pendingOrder?.providerPaymentId) {
        providerPaymentId = pendingOrder.providerPaymentId || undefined;
      }

      const isWallet = purpose === 'wallet'
        || Boolean(depositId)
        || (Boolean(pendingWallet?.depositId) && !orderId);

      if (isWallet) {
        setKind('wallet');

        if (!depositId && !providerPaymentId) {
          setPhase('error');
          setMessage('Не найдено пополнение для подтверждения оплаты');
          return;
        }

        // Stub ЮKassa: фронт сам завершает пополнение.
        if (isStub) {
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

        // T-Bank: webhook зачисляет баланс; UI ждёт Succeeded.
        // depositId из SuccessURL достаточно (GET /deposits/{id}); walletId — опциональный fallback.
        if (!depositId && !walletId) {
          setPhase('error');
          setMessage(
            'Не найден depositId для проверки статуса пополнения. '
            + 'Если списание прошло, обновите кошелёк чуть позже.',
          );
          return;
        }

        setMessage('Ожидаем подтверждение пополнения от банка…');
        const result = await waitForWalletDepositTerminal(
          { walletId, depositId, providerPaymentId },
          status => {
            if (status === 'Pending') {
              setMessage('Ожидаем подтверждение пополнения от банка…');
            }
          },
        );

        if (result === 'ok') {
          try { sessionStorage.removeItem(PENDING_WALLET_KEY); } catch { /* ignore */ }
          setPhase('ok');
          setMessage('Баланс тарифного кошелька пополнен.');
          toast('Пополнение подтверждено', 'success');
          return;
        }

        if (result === 'fail') {
          setPhase('error');
          setMessage('Пополнение не прошло или было отменено.');
          return;
        }

        setPhase('error');
        setMessage(
          'Не дождались подтверждения пополнения. Если списание прошло, баланс обновится '
          + 'после уведомления от банка — откройте кошелёк чуть позже.',
        );
        return;
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
