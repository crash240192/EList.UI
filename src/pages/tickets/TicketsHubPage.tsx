// pages/tickets/TicketsHubPage.tsx — hub «Билеты» (W6c / polish)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchTicketDeskHub,
  type TicketDeskHubItem,
} from '@/entities/event';
import { usePageTitle } from '@/shared/hooks';
import { Button } from '@/shared/ui/Button';
import styles from './TicketsHubPage.module.css';

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

function formatRange(start: string, end: string): string {
  const a = formatWhen(start);
  if (!end) return a;
  try {
    const sameDay = new Date(start).toDateString() === new Date(end).toDateString();
    if (sameDay) {
      const endTime = new Date(end).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `${a} – ${endTime}`;
    }
  } catch {
    /* fall through */
  }
  return `${a} – ${formatWhen(end)}`;
}

export default function TicketsHubPage() {
  usePageTitle('Билеты');
  const [items, setItems] = useState<TicketDeskHubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgFilter, setOrgFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const hub = await fetchTicketDeskHub(100);
      // Пояс: API уже фильтрует ticketsEnabled; на клиенте — страховка
      setItems(hub.filter(i => i.ticketsEnabled !== false));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить список');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const orgOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (item.organizationId) {
        map.set(item.organizationId, item.organizationName || item.organizationId.slice(0, 8));
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  const visible = useMemo(() => {
    if (orgFilter === 'all') return items;
    return items.filter(i => i.organizationId === orgFilter);
  }, [items, orgFilter]);

  const showOrgFilter = orgOptions.length > 1;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.head}>
          <h1 className={styles.title}>Билеты</h1>
          <p className={styles.subtitle}>
            Мероприятия с включёнными билетами. Откройте desk для скана и контроля входа.
          </p>
        </div>
        <div className={styles.body}>
          <div className={styles.filters}>
            {showOrgFilter && (
              <select
                className={styles.select}
                value={orgFilter}
                onChange={e => setOrgFilter(e.target.value)}
                aria-label="Организация"
              >
                <option value="all">Все организации</option>
                {orgOptions.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            )}
            <Button size="sm" variant="secondary" onClick={() => { void load(); }}>
              Обновить
            </Button>
          </div>

          {loading && <p className={styles.loading}>Загрузка…</p>}
          {error && <p className={styles.error}>{error}</p>}
          {!loading && !error && visible.length === 0 && (
            <p className={styles.empty}>
              Нет мероприятий с включёнными билетами. Включите билеты в параметрах события
              или назначьте билетёра на такое событие.
            </p>
          )}

          {!loading && visible.length > 0 && (
            <ul className={styles.list}>
              {visible.map(item => (
                <li key={item.eventId}>
                  <Link
                    className={styles.row}
                    to={`/tickets/desk?eventId=${encodeURIComponent(item.eventId)}`}
                  >
                    <div className={styles.rowTop}>
                      <div>
                        <div className={styles.eventName}>{item.name}</div>
                        {item.organizationName && (
                          <div className={styles.org}>
                            <span className={styles.orgLabel}>Организация · </span>
                            {item.organizationName}
                          </div>
                        )}
                        <div className={styles.meta}>
                          {formatRange(item.startTime, item.endTime)}
                        </div>
                        {item.address && (
                          <div className={styles.address}>{item.address}</div>
                        )}
                      </div>
                      <div className={styles.chips}>
                        {item.access === 'staff' ? (
                          <span className={styles.chipStaff}>Билетёр</span>
                        ) : (
                          <span className={styles.chip}>Организатор</span>
                        )}
                        {!item.active && (
                          <span className={styles.chipMuted}>Неактивно</span>
                        )}
                      </div>
                    </div>
                    {item.canViewStats && (
                      <div className={styles.badges}>
                        <span className={styles.badgeAccent}>
                          Продано {item.sold ?? 0}
                        </span>
                        <span className={styles.badge}>
                          На площадке {item.used ?? 0}
                        </span>
                        <span className={styles.badge}>
                          Ещё войдут {item.issuedOpen ?? 0}
                        </span>
                        {(item.ordersPending ?? 0) > 0 && (
                          <span className={styles.badge}>
                            Pending {item.ordersPending}
                          </span>
                        )}
                        {item.remaining != null && (
                          <span className={styles.badge}>
                            Осталось {item.remaining}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
