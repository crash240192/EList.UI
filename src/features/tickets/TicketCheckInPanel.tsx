// features/tickets/TicketCheckInPanel.tsx
// Минимальный check-in для организатора: код → проверить / погасить.

import { useState } from 'react';
import {
  checkInTicket,
  validateTicket,
  TICKET_STATUS_LABELS,
  type ITicket,
} from '@/entities/order';
import { useToastStore } from '@/app/store';
import { Button } from '@/shared/ui/Button';
import styles from './TicketCheckInPanel.module.css';

interface TicketCheckInPanelProps {
  eventId: string;
}

export function TicketCheckInPanel({ eventId }: TicketCheckInPanelProps) {
  const toast = useToastStore(s => s.add);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'validate' | 'checkin' | null>(null);
  const [last, setLast] = useState<ITicket | null>(null);

  const trimmed = code.trim();

  const run = async (mode: 'validate' | 'checkin') => {
    if (!trimmed || busy) return;
    setBusy(mode);
    try {
      const ticket = mode === 'validate'
        ? await validateTicket({ eventId, code: trimmed })
        : await checkInTicket({ eventId, code: trimmed });
      setLast(ticket);
      toast(
        mode === 'validate' ? 'Билет найден' : 'Билет погашен',
        'success',
      );
      if (mode === 'checkin') setCode('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось обработать код', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.label}>Проверка билетов</div>
      <p className={styles.hint}>Введите код билета, чтобы проверить или погасить на входе.</p>
      <input
        className={styles.input}
        value={code}
        onChange={e => setCode(e.target.value)}
        placeholder="Код билета"
        autoComplete="off"
        disabled={busy != null}
        onKeyDown={e => {
          if (e.key === 'Enter') void run('validate');
        }}
      />
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
