// pages/tickets/TicketsHubPage.tsx — hub «Билеты» (W6c)

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
      setItems(hub);
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

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.head}>
          <h1 className={styles.title}>Билеты</h1>
          <p className={styles.subtitle}>
            Мероприятия для контроля входа. Откройте desk, чтобы сканировать и гасить билеты.
          </p>
        </div>
        <div className={styles.body}>
          {orgOptions.length > 1 && (
            <div className={styles.filters}>
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
              <Button size="sm" variant="secondary" onClick={() => { void load(); }}>
                Обновить
              </Button>
            </div>
          )}

          {loading && <p className={styles.loading}>Загрузка…</p>}
          {error && <p className={styles.error}>{error}</p>}
          {!loading && !error && visible.length === 0 && (
            <p className={styles.empty}>
              Нет доступных мероприятий. Назначьте билетёра на событие или откройте событие
              организации с продажей билетов.
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
                        <div className={styles.meta}>
                          {formatWhen(item.startTime)}
                          {item.organizationName ? ` · ${item.organizationName}` : ''}
                          {item.access === 'staff' ? ' · билетёр' : ' · организатор'}
                        </div>
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
