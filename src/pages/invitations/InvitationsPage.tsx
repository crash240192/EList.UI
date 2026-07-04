// pages/invitations/InvitationsPage.tsx — макет examples/elist_invitations.html

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchUserInvitations,
  markInvitationViewed,
  markAllInvitationsViewed,
  type IInvitation,
} from '@/entities/invitation/invitationsApi';
import { isInvitationUnviewed } from '@/entities/invitation/invitationViewed';
import { useInvitationsStore } from '@/features/invitations/invitationsStore';
import { apiClient } from '@/shared/api/client';
import { isAccessDeniedError, isApiError } from '@/shared/api/apiErrorUtils';
import { useToastStore } from '@/app/store';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { getEventCoverBackground } from '@/shared/lib/eventCoverGradient';
import { TabBar } from '@/shared/ui/TabBar';
import { EventTypeChip } from '@/shared/ui/EventTypeChip';
import { EventListItem } from '@/entities/event/ui/EventListItem';
import listItemStyles from '@/entities/event/ui/EventListItem/EventListItem.module.css';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
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

function inviterName(inv: IInvitation): string {
  const p = inv.inviter?.personInfo;
  if (p?.firstName) return `${p.firstName} ${p.lastName ?? ''}`.trim();
  return inv.inviter?.account?.login ?? 'Неизвестный';
}

function inviterInitials(inv: IInvitation): string {
  const p = inv.inviter?.personInfo;
  if (p?.firstName) return `${p.firstName[0]}${p.lastName?.[0] ?? ''}`.toUpperCase();
  return inv.inviter?.account?.login?.[0]?.toUpperCase() ?? '?';
}

function EventTypeTags({ types, className }: { types: IEventType[]; className?: string }) {
  if (types.length === 0) return null;
  return (
    <div className={className}>
      {types.slice(0, 3).map(t => (
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

export default function InvitationsPage() {
  const navigate = useNavigate();
  const refreshNotViewedCount = useInvitationsStore(s => s.refreshNotViewedCount);
  const [tab, setTab] = useState<Tab>('incoming');
  const [items, setItems] = useState<IInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [previewInv, setPreviewInv] = useState<IInvitation | null>(null);
  const [confirmDecl, setConfirmDecl] = useState<IInvitation | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

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
    navigate(`/event/${inv.eventId}`);
  };

  const openPreview = (inv: IInvitation) => {
    void markViewedIfNeeded(inv);
    setPreviewInv(inv);
  };

  const doAccept = async (inv: IInvitation) => {
    try {
      await apiClient.get(`/api/invitations/accept?invitationId=${inv.id}`);
      setItems(prev => prev.filter(i => i.id !== inv.id));
      setPreviewInv(null);
      void refreshNotViewedCount();
      navigate(`/event/${inv.eventId}`);
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
              { id: 'sent', label: 'Отправленные', count: 0 },
            ]}
            activeId={tab}
            onChange={id => setTab(id as typeof tab)}
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
                <div className={styles.emptyIllo}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 13a19.8 19.8 0 01-3.07-8.67A2 2 0 012 2.18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                  </svg>
                </div>
                <p className={styles.emptyTitle}>Приглашений пока нет</p>
                <p className={styles.emptySub}>Когда вас пригласят на мероприятие, оно появится здесь</p>
              </div>
            )}

            {!loading && items.map(inv => (
              <InvitationRow
                key={inv.id}
                inv={inv}
                onOpen={() => handleInvitationClick(inv)}
                onPreview={() => openPreview(inv)}
                onDecline={() => setConfirmDecl(inv)}
              />
            ))}
          </div>
            </div>

            <div className={`${styles.tabPane} ${tab === 'sent' ? styles.tabPaneActive : ''}`}>
              <div className={styles.invList}>
                <div className={styles.emptyState}>
                  <p className={styles.emptyTitle}>Отправленных приглашений нет</p>
                  <p className={styles.emptySub}>
                    Приглашения, которые вы отправили участникам своих событий, будут отображаться здесь
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {previewInv && (
        <AcceptDialog
          inv={previewInv}
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
    </div>
  );
}

function InvitationRow({
  inv,
  onOpen,
  onPreview,
  onDecline,
}: {
  inv: IInvitation;
  onOpen: () => void;
  onPreview: () => void;
  onDecline: () => void;
}) {
  const event = inv.event;
  const urgency = getEventUrgency(event.startTime);
  const unviewed = isInvitationUnviewed(inv);

  return (
    <EventListItem
      event={event}
      onClick={onOpen}
      urgency={urgency}
      unviewed={unviewed}
      header={(
        <>
          <UserAvatar
            accountId={inv.inviterAccountId}
            avatarId={inv.inviter?.account?.avatarId ?? null}
            initials={inviterInitials(inv)}
            size={18}
            className={styles.whoAvatar}
          />
          <span className={styles.inviterText}>
            <span className={styles.inviterName}>{inviterName(inv)}</span> приглашает
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

function AcceptDialog({
  inv,
  onClose,
  onAccept,
}: {
  inv: IInvitation;
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
            <UserAvatar
              accountId={inv.inviterAccountId}
              avatarId={inv.inviter?.account?.avatarId ?? null}
              initials={inviterInitials(inv)}
              size={28}
              className={styles.dialogInviterAv}
            />
            <span className={styles.dialogInviterText}>
              <span className={styles.dialogInviterName}>{inviterName(inv)}</span> пригласил(а) вас
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
