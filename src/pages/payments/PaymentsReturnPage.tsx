// pages/payments/PaymentsReturnPage.tsx
// Возврат из платёжного виджета (confirmationUrl / stub returnUrl).
// Query: orderId | depositId + paymentId, stub=1, purpose=wallet

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { completePayment } from '@/entities/order';
import { completeWalletDeposit } from '@/entities/user/walletApi';
import { usePageTitle } from '@/shared/hooks';
import { useToastStore } from '@/app/store';
import { Button } from '@/shared/ui/Button';
import styles from './PaymentsReturnPage.module.css';

const PENDING_ORDER_KEY = 'elist_pending_payment';
const PENDING_WALLET_KEY = 'elist_pending_wallet_deposit';

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
