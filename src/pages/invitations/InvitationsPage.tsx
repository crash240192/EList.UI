// pages/invitations/InvitationsPage.tsx — макет examples/elist_invitations.html

import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  fetchUserInvitations,
  searchInvitations,
  cancelInvitation,
  markInvitationViewed,
  markAllInvitationsViewed,
  type IInvitation,
} from '@/entities/invitation/invitationsApi';
import { isInvitationUnviewed } from '@/entities/invitation/invitationViewed';
import { useInvitationsStore } from '@/features/invitations/invitationsStore';
import { useAccountId } from '@/features/auth/useAccountId';
import { fetchAccountById } from '@/entities/user/api';
import {
  fetchOrganizationById,
  getOrganizationAvatar,
} from '@/entities/organization';
import { apiClient } from '@/shared/api/client';
import { isAccessDeniedError, isApiError } from '@/shared/api/apiErrorUtils';
import { useToastStore } from '@/app/store';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { getEventCoverBackground } from '@/shared/lib/eventCoverGradient';
import { TabBar } from '@/shared/ui/TabBar';
import { EventTypeChip } from '@/shared/ui/EventTypeChip';
import { EventListItem } from '@/entities/event/ui/EventListItem';
import { EVENT_TYPE_CHIPS_MAX } from '@/entities/event/lib/eventListItemUtils';
import listItemStyles from '@/entities/event/ui/EventListItem/EventListItem.module.css';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { usePageTitle } from '@/shared/hooks';
import {
  findUrgentInvitation,
  formatInvitationEventDate,
  formatRelativeInviteTime,
  getDaysUntil,
  getEventParams,
  getEventTypes,
  getEventUrgency,
} from './invitationsPageUtils';
import type { IEventType } from '@/entities/event/types';
import styles from './InvitationsPage.module.css';

type Tab = 'incoming' | 'sent';

type OrgInviterInfo = { name: string; logoId: string | null };

function tabFromSearch(params: URLSearchParams): Tab {
  return params.get('tab') === 'sent' ? 'sent' : 'incoming';
}

function personInviterName(inv: IInvitation): string {
  const p = inv.inviter?.personInfo;
  if (p?.firstName) return `${p.firstName} ${p.lastName ?? ''}`.trim();
  return inv.inviter?.account?.login ?? 'Неизвестный';
}

function inviterName(inv: IInvitation, orgById: Record<string, OrgInviterInfo>): string {
  if (inv.inviterOrganizationId) {
    return orgById[inv.inviterOrganizationId]?.name ?? 'Организация';
  }
  return personInviterName(inv);
}

function inviterInitials(inv: IInvitation, orgById: Record<string, OrgInviterInfo>): string {
  if (inv.inviterOrganizationId) {
    const name = orgById[inv.inviterOrganizationId]?.name ?? 'ОР';
    return name.slice(0, 2).toUpperCase();
  }
  const p = inv.inviter?.personInfo;
  if (p?.firstName) return `${p.firstName[0]}${p.lastName?.[0] ?? ''}`.toUpperCase();
  return inv.inviter?.account?.login?.[0]?.toUpperCase() ?? '?';
}

function InviterAvatar({
  inv,
  orgById,
  size,
  className,
}: {
  inv: IInvitation;
  orgById: Record<string, OrgInviterInfo>;
  size: number;
  className?: string;
}) {
  if (inv.inviterOrganizationId) {
    const org = orgById[inv.inviterOrganizationId];
    const initials = inviterInitials(inv, orgById);
    return (
      <div
        className={`${styles.orgAvatar} ${className ?? ''}`}
        style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.38)) }}
        aria-hidden
      >
        {org?.logoId ? (
          <AuthImage
            fileId={org.logoId}
            alt=""
            className={styles.orgAvatarImg}
            fallback={<span>{initials}</span>}
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
    );
  }

  return (
    <UserAvatar
      accountId={inv.inviterAccountId}
      avatarId={inv.inviter?.account?.avatarId ?? null}
      initials={inviterInitials(inv, orgById)}
      size={size}
      className={className}
    />
  );
}

function EventTypeTags({ types, className }: { types: IEventType[]; className?: string }) {
  if (types.length === 0) return null;
  return (
    <div className={className}>
      {types.slice(0, EVENT_TYPE_CHIPS_MAX).map(t => (
        <EventTypeChip
          key={t.id}
          type={t}
          className={styles.chip}
          iconSize={10}
        />
      ))}
    </div>
  );
}

function useInviteeLabel(accountId: string | null | undefined): {
  login: string;
  avatarId: string | null;
  initials: string;
} {
  const [login, setLogin] = useState('участник');
  const [avatarId, setAvatarId] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    fetchAccountById(accountId)
      .then(acc => {
        if (cancelled) return;
        setLogin(acc.login || 'участник');
        setAvatarId(acc.avatarId ?? null);
      })
      .catch(() => { /* defaults */ });
    return () => { cancelled = true; };
  }, [accountId]);

  return {
    login,
    avatarId,
    initials: (login[0] ?? '?').toUpperCase(),
  };
}

export default function InvitationsPage() {
  usePageTitle('Приглашения');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { accountId } = useAccountId();
  const refreshNotViewedCount = useInvitationsStore(s => s.refreshNotViewedCount);
  const tab = tabFromSearch(searchParams);
  const setTab = (next: Tab) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      if (next === 'incoming') p.delete('tab');
      else p.set('tab', next);
      return p;
    }, { replace: true });
  };
  const invitationsReturnTo = `${location.pathname}${location.search}`;
  const openEvent = (eventId: string) => {
    navigate(`/event/${eventId}`, { state: { from: invitationsReturnTo } });
  };
  const [items, setItems] = useState<IInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sentItems, setSentItems] = useState<IInvitation[]>([]);
  const [sentLoading, setSentLoading] = useState(false);
  const [sentErr, setSentErr] = useState<string | null>(null);
  const [sentLoaded, setSentLoaded] = useState(false);
  const [previewInv, setPreviewInv] = useState<IInvitation | null>(null);
  const [confirmDecl, setConfirmDecl] = useState<IInvitation | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<IInvitation | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [orgById, setOrgById] = useState<Record<string, OrgInviterInfo>>({});

  const unviewedCount = useMemo(
    () => items.filter(isInvitationUnviewed).length,
    [items],
  );

  const urgentInv = useMemo(() => findUrgentInvitation(items), [items]);

  useEffect(() => {
    fetchUserInvitations()
      .then(r => setItems(r.result))
      .catch(() => setErr('Не удалось загрузить приглашения'))
      .finally(() => setLoading(false));
    void refreshNotViewedCount();
  }, [refreshNotViewedCount]);

  useEffect(() => {
    if (tab !== 'sent' || !accountId || sentLoaded) return;
    let cancelled = false;
    setSentLoading(true);
    setSentErr(null);
    searchInvitations({ inviterAccountIds: [accountId], pageIndex: 0, pageSize: 50 })
      .then(r => {
        if (cancelled) return;
        setSentItems(r.result);
        setSentLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setSentErr('Не удалось загрузить отправленные приглашения');
      })
      .finally(() => {
        if (!cancelled) setSentLoading(false);
      });
    return () => { cancelled = true; };
  }, [tab, accountId, sentLoaded]);

  // Имена/логотипы организаций-приглашающих
  useEffect(() => {
    const ids = [...new Set(
      [...items, ...sentItems]
        .map(inv => inv.inviterOrganizationId)
        .filter((id): id is string => Boolean(id)),
    )];
    const missing = ids.filter(id => !orgById[id]);
    if (missing.length === 0) return;

    let cancelled = false;
    void Promise.all(
      missing.map(async id => {
        try {
          const [org, logoId] = await Promise.all([
            fetchOrganizationById(id),
            getOrganizationAvatar(id).catch(() => null),
          ]);
          return [id, { name: org.name, logoId }] as const;
        } catch {
          return [id, { name: 'Организация', logoId: null }] as const;
        }
      }),
    ).then(entries => {
      if (cancelled) return;
      setOrgById(prev => ({ ...prev, ...Object.fromEntries(entries) }));
    });
    return () => { cancelled = true; };
  }, [items, sentItems, orgById]);

  const markViewedIfNeeded = async (inv: IInvitation) => {
    if (!isInvitationUnviewed(inv)) return;
    setItems(prev =>
      prev.map(i => (i.id === inv.id ? { ...i, viewed: true } : i)),
    );
    try {
      await markInvitationViewed(inv.id);
      void refreshNotViewedCount();
    } catch {
      setItems(prev =>
        prev.map(i => (i.id === inv.id ? { ...i, viewed: false } : i)),
      );
      void refreshNotViewedCount();
    }
  };

  const handleInvitationClick = (inv: IInvitation) => {
    void markViewedIfNeeded(inv);
    openEvent(inv.eventId);
  };

  const openPreview = (inv: IInvitation) => {
    void markViewedIfNeeded(inv);
    setPreviewInv(inv);
  };

  const doAccept = async (inv: IInvitation) => {
    try {
      await apiClient.get(`/api/invitations/accept?invitationId=${inv.id}`);
      setItems(prev => prev.filter(i => i.id !== inv.id));
      void refreshNotViewedCount();
      // Сначала navigate — иначе cleanup useModalBackButton может вызвать history.back()
      // и отменить переход (или оставить битый history.state.idx).
      openEvent(inv.eventId);
      setPreviewInv(null);
    } catch (e) {
      if (isApiError(e) && isAccessDeniedError(e)) {
        useToastStore.getState().add(e.serverMessage || e.message);
      }
    }
  };

  const markAllViewed = async () => {
    if (unviewedCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllInvitationsViewed();
      setItems(prev => prev.map(i => ({ ...i, viewed: true })));
      void refreshNotViewedCount();
    } catch {
      /* apiClient toast */
    } finally {
      setMarkingAll(false);
    }
  };

  const doDecline = async (inv: IInvitation) => {
    try {
      await apiClient.get(`/api/invitations/decline?invitationId=${inv.id}`);
      setItems(prev => prev.filter(i => i.id !== inv.id));
      setConfirmDecl(null);
      void refreshNotViewedCount();
    } catch { /* ignore */ }
  };

  const doCancel = async (inv: IInvitation) => {
    try {
      await cancelInvitation(inv.id);
      setSentItems(prev => prev.filter(i => i.id !== inv.id));
      setConfirmCancel(null);
    } catch { /* apiClient toast */ }
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderMain}>
              <h1 className={styles.cardTitle}>Приглашения</h1>
              {!loading && tab === 'incoming' && items.length > 0 && (
                <span className={styles.badge}>{items.length}</span>
              )}
              {!sentLoading && tab === 'sent' && sentItems.length > 0 && (
                <span className={styles.badge}>{sentItems.length}</span>
              )}
            </div>
            {!loading && tab === 'incoming' && unviewedCount > 0 && (
              <button
                type="button"
                className={styles.markAllBtn}
                onClick={() => { void markAllViewed(); }}
                disabled={markingAll}
              >
                {markingAll ? 'Отмечаем…' : 'Отметить все просмотренными'}
              </button>
            )}
          </div>

          <TabBar
            tabs={[
              { id: 'incoming', label: 'Входящие', count: !loading ? items.length : undefined },
              { id: 'sent', label: 'Отправленные', count: sentLoaded ? sentItems.length : undefined },
            ]}
            activeId={tab}
            onChange={id => setTab(id as Tab)}
          />

          <div className={styles.cardBody}>
            <div className={`${styles.tabPane} ${tab === 'incoming' ? styles.tabPaneActive : ''}`}>
          {loading && (
            <div className={styles.invList}>
              <div className={styles.skeletons}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={styles.skeleton} />
                ))}
              </div>
            </div>
          )}

          {err && <div className={styles.err}>{err}</div>}

          <div className={styles.invList}>
            {!loading && !err && urgentInv && (
              <div className={styles.urgentStrip}>
                <div>
                  <div className={styles.urgentText}>
                    {getDaysUntil(urgentInv.event.startTime) <= 1
                      ? 'Одно из мероприятий начинается очень скоро'
                      : 'Одно из мероприятий начинается послезавтра'}
                  </div>
                  <div className={styles.urgentSub}>Не забудьте ответить на приглашение</div>
                </div>
              </div>
            )}

            {!loading && !err && items.length === 0 && (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>Приглашений пока нет</p>
                <p className={styles.emptySub}>Когда вас пригласят на мероприятие, оно появится здесь</p>
              </div>
            )}

            {!loading && items.map(inv => (
              <InvitationRow
                key={inv.id}
                inv={inv}
                orgById={orgById}
                onOpen={() => handleInvitationClick(inv)}
                onPreview={() => openPreview(inv)}
                onDecline={() => setConfirmDecl(inv)}
              />
            ))}
          </div>
            </div>

            <div className={`${styles.tabPane} ${tab === 'sent' ? styles.tabPaneActive : ''}`}>
              {sentLoading && (
                <div className={styles.invList}>
                  <div className={styles.skeletons}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className={styles.skeleton} />
                    ))}
                  </div>
                </div>
              )}

              {sentErr && <div className={styles.err}>{sentErr}</div>}

              <div className={styles.invList}>
                {!sentLoading && !sentErr && sentItems.length === 0 && (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyTitle}>Отправленных приглашений нет</p>
                    <p className={styles.emptySub}>
                      Приглашения, которые вы отправили участникам своих событий, будут отображаться здесь
                    </p>
                  </div>
                )}

                {!sentLoading && sentItems.map(inv => (
                  <SentInvitationRow
                    key={inv.id}
                    inv={inv}
                    onOpen={() => openEvent(inv.eventId)}
                    onCancel={() => setConfirmCancel(inv)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {previewInv && (
        <AcceptDialog
          inv={previewInv}
          orgById={orgById}
          onClose={() => setPreviewInv(null)}
          onAccept={() => doAccept(previewInv)}
        />
      )}

      {confirmDecl && (
        <div className={styles.overlay} onClick={() => setConfirmDecl(null)}>
          <div className={styles.declineDialog} onClick={e => e.stopPropagation()}>
            <div className={styles.declineTitle}>Отклонить приглашение?</div>
            <div className={styles.declineText}>
              Вы уверены, что хотите отклонить приглашение на «{confirmDecl.event.name}»?
            </div>
            <div className={styles.declineBtns}>
              <button type="button" className={styles.dbtnCancel} onClick={() => setConfirmDecl(null)}>
                Отмена
              </button>
              <button type="button" className={styles.dbtnDecline} onClick={() => doDecline(confirmDecl)}>
                Отклонить
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmCancel && (
        <div className={styles.overlay} onClick={() => setConfirmCancel(null)}>
          <div className={styles.declineDialog} onClick={e => e.stopPropagation()}>
            <div className={styles.declineTitle}>Отменить приглашение?</div>
            <div className={styles.declineText}>
              Приглашение на «{confirmCancel.event.name}» будет отозвано.
            </div>
            <div className={styles.declineBtns}>
              <button type="button" className={styles.dbtnCancel} onClick={() => setConfirmCancel(null)}>
                Назад
              </button>
              <button type="button" className={styles.dbtnDecline} onClick={() => { void doCancel(confirmCancel); }}>
                Отозвать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InvitationRow({
  inv,
  orgById,
  onOpen,
  onPreview,
  onDecline,
}: {
  inv: IInvitation;
  orgById: Record<string, OrgInviterInfo>;
  onOpen: () => void;
  onPreview: () => void;
  onDecline: () => void;
}) {
  const event = inv.event;
  const urgency = getEventUrgency(event.startTime);
  const unviewed = isInvitationUnviewed(inv);
  const name = inviterName(inv, orgById);

  return (
    <EventListItem
      event={event}
      onClick={onOpen}
      urgency={urgency}
      unviewed={unviewed}
      bleedCover
      header={(
        <>
          <InviterAvatar
            inv={inv}
            orgById={orgById}
            size={18}
            className={styles.whoAvatar}
          />
          <span className={styles.inviterText}>
            <span className={styles.inviterName}>{name}</span> приглашает
          </span>
          <span className={styles.invTime}>{formatRelativeInviteTime(inv.creationDate)}</span>
        </>
      )}
      actions={(
        <>
          <button
            type="button"
            className={`${listItemStyles.actionBtn} ${listItemStyles.actionBtnOk}`}
            onClick={e => { e.stopPropagation(); onPreview(); }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            Принять
          </button>
          <button
            type="button"
            className={`${listItemStyles.actionBtn} ${listItemStyles.actionBtnNo}`}
            onClick={e => { e.stopPropagation(); onDecline(); }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            Отклонить
          </button>
        </>
      )}
    />
  );
}

function SentInvitationRow({
  inv,
  onOpen,
  onCancel,
}: {
  inv: IInvitation;
  onOpen: () => void;
  onCancel: () => void;
}) {
  const event = inv.event;
  const invitee = useInviteeLabel(inv.invitedAccountId);

  return (
    <EventListItem
      event={event}
      onClick={onOpen}
      bleedCover
      header={(
        <>
          <UserAvatar
            accountId={inv.invitedAccountId}
            avatarId={invitee.avatarId}
            initials={invitee.initials}
            size={18}
            className={styles.whoAvatar}
          />
          <span className={styles.inviterText}>
            пригласили <span className={styles.inviterName}>@{invitee.login}</span>
          </span>
          <span className={styles.invTime}>{formatRelativeInviteTime(inv.creationDate)}</span>
        </>
      )}
      actions={(
        <button
          type="button"
          className={`${listItemStyles.actionBtn} ${listItemStyles.actionBtnNo}`}
          onClick={e => { e.stopPropagation(); onCancel(); }}
        >
          Отозвать
        </button>
      )}
    />
  );
}

function AcceptDialog({
  inv,
  orgById,
  onClose,
  onAccept,
}: {
  inv: IInvitation;
  orgById: Record<string, OrgInviterInfo>;
  onClose: () => void;
  onAccept: () => void;
}) {
  useModalBackButton(onClose);
  const event = inv.event;
  const params = getEventParams(event);
  const types = getEventTypes(event);
  const days = getDaysUntil(event.startTime);
  const coverBg = getEventCoverBackground(event as Parameters<typeof getEventCoverBackground>[0]);
  const daysLabel = days === 0 ? 'сегодня' : days === 1 ? 'завтра' : days > 0 ? `через ${days} дн.` : '';
  const name = inviterName(inv, orgById);
  const fromOrg = Boolean(inv.inviterOrganizationId);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()} role="dialog" aria-modal aria-label={event.name}>
        <div className={styles.dialogCover} style={{ background: coverBg }}>
          {event.coverImageId && (
            <AuthImage fileId={event.coverImageId} alt="" className={styles.dialogCoverImg} />
          )}
          <div className={styles.dialogCoverOverlay} />
        </div>
        <div className={styles.dialogBody}>
          <div className={styles.dialogInviter}>
            <InviterAvatar
              inv={inv}
              orgById={orgById}
              size={28}
              className={styles.dialogInviterAv}
            />
            <span className={styles.dialogInviterText}>
              <span className={styles.dialogInviterName}>{name}</span>
              {fromOrg ? ' приглашает вас' : ' пригласил(а) вас'}
            </span>
          </div>
          <div className={styles.dialogEventName}>{event.name}</div>
          {types.length > 0 && (
            <EventTypeTags types={types} className={styles.dialogChips} />
          )}
          <div className={styles.dialogMeta}>
            <div className={styles.dmetaRow}>
              <div>
                <div className={styles.dmetaLabel}>Дата</div>
                <div className={styles.dmetaVal}>{formatInvitationEventDate(event.startTime)}</div>
                {daysLabel && <div className={styles.dmetaSub}>{daysLabel}</div>}
              </div>
            </div>
            {event.address && (
              <div className={styles.dmetaRow}>
                <div>
                  <div className={styles.dmetaLabel}>Место</div>
                  <div className={styles.dmetaVal}>{event.address}</div>
                </div>
              </div>
            )}
            <div className={styles.dmetaRow}>
              <div>
                <div className={styles.dmetaLabel}>Стоимость</div>
                <div className={styles.dmetaVal} style={params.cost === 0 ? { color: 'var(--success)' } : undefined}>
                  {params.cost === 0 ? 'Бесплатно' : `${params.cost.toLocaleString('ru-RU')} ₽`}
                </div>
                {params.maxPersonsCount != null && params.participantsCount != null && (
                  <div className={styles.dmetaSub}>
                    {params.participantsCount} из {params.maxPersonsCount} мест занято
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className={styles.dialogBtns}>
            <button type="button" className={styles.dbtnLater} onClick={onClose}>Решу позже</button>
            <button type="button" className={styles.dbtnAccept} onClick={onAccept}>Принять приглашение</button>
          </div>
        </div>
      </div>
    </div>
  );
}
