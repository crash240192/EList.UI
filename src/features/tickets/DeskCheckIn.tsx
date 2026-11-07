// features/tickets/DeskCheckIn.tsx — desk: validate → карточка → confirm / undo

import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import {
  checkInTicket,
  undoCheckInTicket,
  validateTicket,
  TICKET_STATUS_LABELS,
  type ITicket,
} from '@/entities/order';
import { useToastStore } from '@/app/store';
import { canUseQrScanner } from '@/shared/lib/userId';
import { parseTicketCodeFromText } from '@/shared/lib/ticketCode';
import { Button } from '@/shared/ui/Button';
import styles from './DeskCheckIn.module.css';

const QrScanner = lazy(() =>
  import('@/shared/ui/QrScanner/QrScanner').then((m) => ({ default: m.QrScanner })),
);

interface DeskCheckInProps {
  eventId: string;
  canCheckIn?: boolean;
  /** Owner/Manager only — TicketTaker не видит undo */
  canUndoCheckIn?: boolean;
  onCheckedIn?: (ticket: ITicket) => void;
  onUndone?: (ticket: ITicket) => void;
}

function formatCheckedIn(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function DeskCheckIn({
  eventId,
  canCheckIn = true,
  canUndoCheckIn = false,
  onCheckedIn,
  onUndone,
}: DeskCheckInProps) {
  const toast = useToastStore(s => s.add);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'validate' | 'checkin' | 'undo' | null>(null);
  const [card, setCard] = useState<ITicket | null>(null);
  const [scanning, setScanning] = useState(false);
  const busyRef = useRef(false);
  const showScanner = canUseQrScanner();

  const openCard = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value || busyRef.current) return;
    busyRef.current = true;
    setBusy('validate');
    try {
      const ticket = await validateTicket({ eventId, code: value });
      setCard(ticket);
      setCode(value);
    } catch (e) {
      setCard(null);
      toast(e instanceof Error ? e.message : 'Билет не найден', 'error');
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }, [eventId, toast]);

  const confirmCheckIn = useCallback(async () => {
    if (!card || !canCheckIn || busyRef.current) return;
    if (card.status !== 'Issued') {
      toast('Отметить можно только билет со статусом «Выдан»', 'error');
      return;
    }
    busyRef.current = true;
    setBusy('checkin');
    try {
      const ticket = await checkInTicket({ eventId, code: card.code });
      setCard(ticket);
      setCode('');
      toast('Вход отмечен', 'success');
      onCheckedIn?.(ticket);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось отметить вход', 'error');
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }, [card, canCheckIn, eventId, onCheckedIn, toast]);

  const confirmUndo = useCallback(async () => {
    if (!card || !canUndoCheckIn || busyRef.current) return;
    if (card.status !== 'Used') {
      toast('Отменить можно только отмеченный вход', 'error');
      return;
    }
    busyRef.current = true;
    setBusy('undo');
    try {
      const ticket = await undoCheckInTicket({ eventId, code: card.code });
      setCard(ticket);
      toast('Вход отменён', 'success');
      onUndone?.(ticket);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось отменить вход', 'error');
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }, [card, canUndoCheckIn, eventId, onUndone, toast]);

  const handleDetected = useCallback((value: string) => {
    setScanning(false);
    void openCard(value);
  }, [openCard]);

  const statusClass = card?.status === 'Used'
    ? styles.cardStatusUsed
    : (card?.status === 'Issued' ? styles.cardStatus : styles.cardStatusBad);

  const checkedInLabel = formatCheckedIn(card?.checkedInAt);

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>Контроль входа</div>
      <p className={styles.hint}>
        Скан или код → карточка билета → «Отметить вход». Без подтверждения билет не гасится.
      </p>

      {scanning ? (
        <Suspense fallback={<p className={styles.scanLoading}>Подключение камеры…</p>}>
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
              if (e.key === 'Enter') void openCard(code);
            }}
          />
          <div className={styles.actions}>
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
            <Button
              size="sm"
              disabled={!code.trim() || busy != null}
              loading={busy === 'validate'}
              onClick={() => { void openCard(code); }}
            >
              Найти билет
            </Button>
          </div>
        </>
      )}

      {card && (
        <div className={styles.card} role="status">
          <div className={statusClass}>
            {TICKET_STATUS_LABELS[card.status] ?? card.status}
          </div>
          {card.ticketTypeName && (
            <div className={styles.cardType}>{card.ticketTypeName}</div>
          )}
          {card.status === 'Used' && checkedInLabel && (
            <div className={styles.cardMeta}>На площадке с {checkedInLabel}</div>
          )}
          {(card.holderDisplayName || card.holderLogin) && (
            <div className={styles.cardMeta}>
              Holder: {card.holderDisplayName || card.holderLogin}
            </div>
          )}
          <div className={styles.cardCode}>{card.code}</div>
          <div className={styles.cardActions}>
            {canCheckIn && card.status === 'Issued' && (
              <Button
                loading={busy === 'checkin'}
                disabled={busy != null}
                onClick={() => { void confirmCheckIn(); }}
              >
                Отметить вход
              </Button>
            )}
            {canUndoCheckIn && card.status === 'Used' && (
              <Button
                variant="secondary"
                loading={busy === 'undo'}
                disabled={busy != null}
                onClick={() => { void confirmUndo(); }}
              >
                Отменить вход
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              disabled={busy != null}
              onClick={() => setCard(null)}
            >
              Закрыть
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
