// features/user/ProfileInviteDialogs.tsx
// Приглашение пользователя с профиля на несколько своих / org-событий.

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchEvents } from '@/entities/event';
import {
  createInvitationsToAccount,
  searchInvitations,
} from '@/entities/invitation/invitationsApi';
import { fetchCanInvite } from '@/entities/user/privacyApi';
import {
  fetchMyOrganizations,
  type OrganizationResponse,
} from '@/entities/organization';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import styles from './ProfileInviteDialogs.module.css';

type InviteSource = 'self' | 'organization';

type EventRowStatus = 'ok' | 'alreadyInvited' | 'alreadyParticipating' | 'blocked';

interface InviteEventRow {
  id: string;
  name: string;
  startTime: string;
  status: EventRowStatus;
  statusLabel?: string;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function loadInviteEvents(params: {
  myAccountId: string;
  profileAccountId: string;
  source: InviteSource;
  organizationId: string | null;
}): Promise<InviteEventRow[]> {
  const now = new Date().toISOString();
  const base = {
    startTime: now,
    orderBy: 'StartTime' as const,
    pageIndex: 0,
    pageSize: 100,
    active: true,
  };

  const page = params.source === 'organization' && params.organizationId
    ? await fetchEvents({ ...base, organizationId: params.organizationId })
    : await fetchEvents({ ...base, organizatorId: params.myAccountId });

  const events = page.result ?? [];
  if (events.length === 0) return [];

  const eventIds = events.map(e => e.id);
  const existing = await searchInvitations({
    invitedAccountIds: [params.profileAccountId],
    eventIds,
    pageIndex: 0,
    pageSize: Math.max(50, eventIds.length),
  }).catch(() => ({ result: [] as Awaited<ReturnType<typeof searchInvitations>>['result'], total: 0 }));

  const invitedSet = new Set(existing.result.map(inv => inv.eventId));

  return events
    .map(event => {
      const alreadyInvited = invitedSet.has(event.id);
      return {
        id: event.id,
        name: event.name,
        startTime: event.startTime,
        status: alreadyInvited ? 'alreadyInvited' as const : 'ok' as const,
        statusLabel: alreadyInvited ? 'Уже приглашён' : undefined,
      };
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

export function InviteBlockedDialog({
  reason,
  onClose,
}: {
  reason: string;
  onClose: () => void;
}) {
  useModalBackButton(onClose);

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.spam} role="dialog" aria-modal aria-labelledby="invite-blocked-text">
        <p id="invite-blocked-text" className={styles.spamText}>{reason}</p>
        <div className={styles.spamActions}>
          <button type="button" className={styles.primaryBtn} onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </>,
    document.body,
  );
}

export function ProfileEventInviteModal({
  myAccountId,
  profileAccountId,
  onClose,
}: {
  myAccountId: string;
  profileAccountId: string;
  onClose: () => void;
}) {
  useModalBackButton(onClose);

  const [source, setSource] = useState<InviteSource>('self');
  const [orgs, setOrgs] = useState<OrganizationResponse[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [events, setEvents] = useState<InviteEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSummary, setSendSummary] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyOrganizations()
      .then(list => {
        if (cancelled) return;
        const active = list.filter(o => o.active !== false);
        setOrgs(active);
        if (active.length > 0) setOrgId(prev => prev ?? active[0].id);
      })
      .catch(() => {
        if (!cancelled) setOrgs([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setSelected(new Set());
    setSendSummary(null);
    setSendError(null);

    if (source === 'organization' && !orgId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    loadInviteEvents({
      myAccountId,
      profileAccountId,
      source,
      organizationId: source === 'organization' ? orgId : null,
    })
      .then(rows => {
        if (!cancelled) setEvents(rows);
      })
      .catch(e => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить мероприятия');
          setEvents([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [myAccountId, profileAccountId, source, orgId]);

  const selectableIds = useMemo(
    () => events.filter(e => e.status === 'ok').map(e => e.id),
    [events],
  );

  const toggle = (id: string) => {
    const row = events.find(e => e.id === id);
    if (!row || row.status !== 'ok') return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    const ids = [...selected].filter(id => selectableIds.includes(id));
    if (ids.length === 0 || sending) return;
    setSending(true);
    setSendError(null);
    setSendSummary(null);
    try {
      const result = await createInvitationsToAccount({
        invitedAccountId: profileAccountId,
        eventIds: ids,
        inviterOrganizationId: source === 'organization' ? orgId : null,
      });

      const succeeded = new Set(result.succeededEventIds);
      const failureByEvent = new Map(result.failures.map(f => [f.eventId, f]));

      setEvents(prev => prev.map(row => {
        if (succeeded.has(row.id)) {
          return { ...row, status: 'alreadyInvited', statusLabel: 'Уже приглашён' };
        }
        const fail = failureByEvent.get(row.id);
        if (!fail) return row;
        if (fail.message === 'Уже приглашён') {
          return { ...row, status: 'alreadyInvited', statusLabel: 'Уже приглашён' };
        }
        if (fail.message === 'Уже участвует') {
          return { ...row, status: 'alreadyParticipating', statusLabel: 'Уже участвует' };
        }
        return { ...row, status: 'blocked', statusLabel: fail.message || 'Недоступно' };
      }));
      setSelected(new Set());

      const okCount = result.succeededEventIds.length;
      const failCount = result.failures.length;
      if (okCount > 0 && failCount === 0) {
        onClose();
        return;
      }
      if (okCount > 0) {
        setSendSummary(`Отправлено: ${okCount}. Не удалось: ${failCount}.`);
      } else if (failCount > 0) {
        setSendError(result.failures[0]?.message || 'Не удалось отправить приглашения');
      } else {
        setSendError('Не удалось отправить приглашения');
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Не удалось отправить приглашения');
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-label="Пригласить">
        <div className={styles.header}>
          <h3 className={styles.title}>Пригласить</h3>
        </div>

        <div className={styles.sourceRow} role="tablist" aria-label="От чьего имени">
          <button
            type="button"
            role="tab"
            aria-selected={source === 'self'}
            className={`${styles.sourceBtn} ${source === 'self' ? styles.sourceBtnOn : ''}`}
            onClick={() => setSource('self')}
          >
            От себя
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={source === 'organization'}
            className={`${styles.sourceBtn} ${source === 'organization' ? styles.sourceBtnOn : ''}`}
            onClick={() => setSource('organization')}
            disabled={orgs.length === 0}
            title={orgs.length === 0 ? 'Нет доступных организаций' : undefined}
          >
            От организации
          </button>
        </div>

        {source === 'organization' && orgs.length > 0 && (
          <div className={styles.orgRow}>
            <label className={styles.orgLabel} htmlFor="invite-org-select">Организация</label>
            <select
              id="invite-org-select"
              className={styles.orgSelect}
              value={orgId ?? ''}
              onChange={e => setOrgId(e.target.value || null)}
            >
              {orgs.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.list}>
          {loading && <p className={styles.empty}>Загрузка…</p>}
          {!loading && loadError && <p className={styles.error}>{loadError}</p>}
          {!loading && !loadError && source === 'organization' && orgs.length === 0 && (
            <p className={styles.empty}>Нет организаций, от имени которых можно приглашать</p>
          )}
          {!loading && !loadError && events.length === 0 && !(source === 'organization' && orgs.length === 0) && (
            <p className={styles.empty}>Нет предстоящих мероприятий</p>
          )}
          {!loading && !loadError && events.map(event => {
            const disabled = event.status !== 'ok';
            const on = selected.has(event.id);
            return (
              <button
                key={event.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-disabled={disabled}
                disabled={disabled}
                className={`${styles.item} ${on ? styles.itemOn : ''} ${disabled ? styles.itemDisabled : ''}`}
                onClick={() => toggle(event.id)}
              >
                <span className={`${styles.box} ${on ? styles.boxOn : ''}`} aria-hidden>
                  {on && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  )}
                </span>
                <span className={styles.itemText}>
                  <span className={styles.itemName}>{event.name}</span>
                  <span className={styles.itemWhen}>{formatWhen(event.startTime)}</span>
                </span>
                {event.statusLabel ? (
                  <span className={styles.role}>{event.statusLabel}</span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className={styles.footer}>
          {sendError && <span className={styles.footerError}>{sendError}</span>}
          {sendSummary && !sendError && <span className={styles.footerOk}>{sendSummary}</span>}
          <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={sending}>
            Отмена
          </button>
          <button
            type="button"
            className={styles.sendBtn}
            onClick={() => void handleSend()}
            disabled={sending || selected.size === 0}
          >
            {sending ? 'Отправка…' : 'Отправить'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

/** Проверка canInvite перед открытием модалки — для использования с кнопки профиля. */
export async function checkCanInviteOrReason(accountId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const result = await fetchCanInvite(accountId);
    if (result.allowed) return { ok: true };
    return {
      ok: false,
      reason: result.reason || 'Пользователь ограничил круг лиц, которые могут его приглашать',
    };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : 'Не удалось проверить возможность приглашения',
    };
  }
}
