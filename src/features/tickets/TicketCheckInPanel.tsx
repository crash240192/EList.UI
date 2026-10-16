// features/tickets/TicketCheckInPanel.tsx
// Check-in для организатора: код вручную или QR-камерой → проверить / погасить.

import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import {
  checkInTicket,
  validateTicket,
  TICKET_STATUS_LABELS,
  type ITicket,
} from '@/entities/order';
import { useToastStore } from '@/app/store';
import { canUseQrScanner } from '@/shared/lib/userId';
import { parseTicketCodeFromText } from '@/shared/lib/ticketCode';
import { Button } from '@/shared/ui/Button';
import styles from './TicketCheckInPanel.module.css';

const QrScanner = lazy(() =>
  import('@/shared/ui/QrScanner/QrScanner').then((m) => ({ default: m.QrScanner })),
);

interface TicketCheckInPanelProps {
  eventId: string;
}

export function TicketCheckInPanel({ eventId }: TicketCheckInPanelProps) {
  const toast = useToastStore(s => s.add);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'validate' | 'checkin' | null>(null);
  const [last, setLast] = useState<ITicket | null>(null);
  const [scanning, setScanning] = useState(false);
  const busyRef = useRef(false);
  const showScanner = canUseQrScanner();

  const trimmed = code.trim();

  const run = useCallback(async (mode: 'validate' | 'checkin', rawCode?: string) => {
    const value = (rawCode ?? code).trim();
    if (!value || busyRef.current) return;
    busyRef.current = true;
    setBusy(mode);
    try {
      const ticket = mode === 'validate'
        ? await validateTicket({ eventId, code: value })
        : await checkInTicket({ eventId, code: value });
      setLast(ticket);
      toast(
        mode === 'validate' ? 'Билет найден' : 'Билет погашен',
        'success',
      );
      if (mode === 'checkin') setCode('');
      else setCode(value);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось обработать код', 'error');
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }, [code, eventId, toast]);

  const handleDetected = useCallback((value: string) => {
    setCode(value);
    setScanning(false);
    void run('checkin', value);
  }, [run]);

  return (
    <div className={styles.panel}>
      <div className={styles.label}>Проверка билетов</div>
      <p className={styles.hint}>
        {showScanner
          ? 'Введите код билета или отсканируйте QR на входе.'
          : 'Введите код билета, чтобы проверить или погасить на входе.'}
      </p>

      {scanning ? (
        <Suspense fallback={<p className={styles.scanLoading}>Подключение камеры...</p>}>
          <QrScanner
            onDetected={handleDetected}
            onClose={() => setScanning(false)}
            parse={parseTicketCodeFromText}
          />
        </Suspense>
      ) : (
        <>
          <input
            className={styles.input}
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Код билета (EL…)"
            autoComplete="off"
            disabled={busy != null}
            onKeyDown={e => {
              if (e.key === 'Enter') void run('validate');
            }}
          />
          {showScanner && (
            <button
              type="button"
              className={styles.scanBtn}
              disabled={busy != null}
              onClick={() => setScanning(true)}
            >
              Сканировать QR
            </button>
          )}
          <div className={styles.actions}>
            <Button
              size="sm"
              variant="secondary"
              disabled={!trimmed || busy != null}
              loading={busy === 'validate'}
              onClick={() => { void run('validate'); }}
            >
              Проверить
            </Button>
            <Button
              size="sm"
              disabled={!trimmed || busy != null}
              loading={busy === 'checkin'}
              onClick={() => { void run('checkin'); }}
            >
              Погасить
            </Button>
          </div>
        </>
      )}

      {last && (
        <div className={styles.result} role="status">
          <span className={styles.resultStatus}>
            {TICKET_STATUS_LABELS[last.status] ?? last.status}
          </span>
          <span className={styles.resultCode}>{last.code}</span>
        </div>
      )}
    </div>
  );
}
