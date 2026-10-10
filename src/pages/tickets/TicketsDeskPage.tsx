// pages/tickets/TicketsDeskPage.tsx — desk контроля входа (W6c/W6e)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import {
  fetchEventById,
  fetchEventTicketStats,
  fetchTicketDeskHub,
  type EventTicketStatsResponse,
  type TicketDeskHubItem,
} from '@/entities/event';
import { DeskCheckIn } from '@/features/tickets';
import { usePageTitle } from '@/shared/hooks';
import { Button } from '@/shared/ui/Button';
import styles from './TicketsDeskPage.module.css';

const STATS_POLL_MS = 10_000;

function formatWhen(iso: string): string {
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

export default function TicketsDeskPage() {
  const [searchParams] = useSearchParams();
  const eventId = (searchParams.get('eventId') ?? '').trim();
  usePageTitle('Контроль входа');

  const [hubItem, setHubItem] = useState<TicketDeskHubItem | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);
  const [stats, setStats] = useState<EventTicketStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!eventId) return;
    const silent = Boolean(opts?.silent);
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const hub = await fetchTicketDeskHub(100);
      const item = hub.find(h => h.eventId === eventId) ?? null;
      setHubItem(item);

      if (!item) {
        if (!silent) {
          try {
            const ev = await fetchEventById(eventId);
            setEventName(ev?.name ?? null);
          } catch {
            setEventName(null);
          }
          setStats(null);
          setError('Нет доступа к контролю входа этого события');
        }
        return;
      }

      setEventName(item.name);
      setError(null);
      if (item.canViewStats) {
        try {
          const s = await fetchEventTicketStats(eventId);
          setStats(s);
        } catch {
          if (!silent) setStats(null);
        }
      } else if (!silent) {
        setStats(null);
      }
    } catch (e) {
      if (!silent) {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить desk');
        setHubItem(null);
        setStats(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live counters (UC-S4)
  useEffect(() => {
    if (!eventId || !hubItem?.canViewStats) return;
    const id = window.setInterval(() => {
      void load({ silent: true });
    }, STATS_POLL_MS);
    return () => window.clearInterval(id);
  }, [eventId, hubItem?.canViewStats, load]);

  const title = useMemo(
    () => eventName || hubItem?.name || 'Контроль входа',
    [eventName, hubItem?.name],
  );

  const canUndo = Boolean(
    hubItem?.canUndoCheckIn
    ?? (hubItem?.access === 'organizer'),
  );

  if (!eventId) {
    return <Navigate to="/tickets" replace />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.head}>
          <div className={styles.headTop}>
            <Link className={styles.back} to="/tickets">← Билеты</Link>
            <Button size="sm" variant="secondary" onClick={() => { void load(); }}>
              Обновить
            </Button>
          </div>
          <h1 className={styles.title}>{title}</h1>
          {hubItem && (
            <p className={styles.subtitle}>
              {formatWhen(hubItem.startTime)}
              {hubItem.organizationName ? ` · ${hubItem.organizationName}` : ''}
              {hubItem.access === 'staff' ? ' · билетёр' : ' · организатор'}
            </p>
          )}
        </div>

        <div className={styles.body}>
          {loading && <p className={styles.muted}>Загрузка…</p>}
          {error && <p className={styles.error}>{error}</p>}

          {!loading && hubItem?.canViewStats && stats && (
            <>
              <div className={styles.counters} aria-label="Счётчики билетов">
                <div className={styles.counter}>
                  <span className={styles.counterValue}>{stats.sold}</span>
                  <span className={styles.counterLabel}>Продано</span>
                </div>
                <div className={styles.counter}>
                  <span className={styles.counterValue}>{stats.used}</span>
                  <span className={styles.counterLabel}>На площадке</span>
                </div>
                <div className={styles.counter}>
                  <span className={styles.counterValue}>{stats.issuedOpen}</span>
                  <span className={styles.counterLabel}>Ещё войдут</span>
                </div>
                <div className={styles.counter}>
                  <span className={styles.counterValue}>{stats.ordersPending}</span>
                  <span className={styles.counterLabel}>Pending</span>
                </div>
                {stats.remaining != null && (
                  <div className={styles.counter}>
                    <span className={styles.counterValue}>{stats.remaining}</span>
                    <span className={styles.counterLabel}>Осталось</span>
                  </div>
                )}
              </div>

              {stats.byType.length > 0 && (
                <div className={styles.byType}>
                  <div className={styles.byTypeTitle}>По типам</div>
                  <ul className={styles.byTypeList}>
                    {stats.byType.map(t => (
                      <li key={t.ticketTypeId ?? t.ticketTypeName} className={styles.byTypeRow}>
                        <span className={styles.byTypeName}>{t.ticketTypeName}</span>
                        <span className={styles.byTypeMeta}>
                          {t.used}/{t.sold}
                          {t.issuedOpen > 0 ? ` · открыто ${t.issuedOpen}` : ''}
                          {t.remaining != null ? ` · ост. ${t.remaining}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {!loading && hubItem && (
            <DeskCheckIn
              eventId={eventId}
              canCheckIn={hubItem.canCheckIn}
              canUndoCheckIn={canUndo}
              onCheckedIn={() => {
                if (hubItem.canViewStats) void load({ silent: true });
              }}
              onUndone={() => {
                if (hubItem.canViewStats) void load({ silent: true });
              }}
            />
          )}

          {!loading && !hubItem && !error && (
            <p className={styles.muted}>Событие недоступно для контроля входа.</p>
          )}
        </div>
      </div>
    </div>
  );
}
