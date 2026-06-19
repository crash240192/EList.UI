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
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { icoToUrl } from '@/shared/lib/icoToUrl';
import { getEventCoverBackground } from '@/shared/lib/eventCoverGradient';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import {
  findUrgentInvitation,
  formatInvitationEventDate,
  formatInvitationEventDateShort,
  formatRelativeInviteTime,
  getDaysUntil,
  getEventParams,
  getEventTypes,
  getEventUrgency,
} from './invitationsPageUtils';
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
      <div className={styles.topbar}>
        <div className={styles.topbarMain}>
          <h1 className={styles.pageTitle}>Приглашения</h1>
          {!loading && tab === 'incoming' && items.length > 0 && (
            <span className={styles.titleBadge}>{items.length}</span>
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

      <div className={styles.tabsBar}>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === 'incoming' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('incoming')}
        >
          Входящие
          {!loading && items.length > 0 && (
            <span className={styles.tabCnt}>{items.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === 'sent' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('sent')}
        >
          Отправленные
          <span className={styles.tabCnt}>0</span>
        </button>
      </div>

      <div className={styles.content}>
        <div className={`${styles.tabPane} ${tab === 'incoming' ? styles.tabPaneActive : ''}`}>
          {loading && (
            <div className={styles.skeletons}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={styles.skeleton} />
              ))}
            </div>
          )}

          {err && <div className={styles.err}>{err}</div>}

          {!loading && !err && urgentInv && (
            <div className={styles.urgentStrip}>
              <div className={styles.urgentIco}>⏰</div>
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
            <InvitationCard
              key={inv.id}
              inv={inv}
              onOpen={() => handleInvitationClick(inv)}
              onPreview={() => openPreview(inv)}
              onDecline={() => setConfirmDecl(inv)}
              onLater={() => { void markViewedIfNeeded(inv); }}
            />
          ))}
        </div>

        <div className={`${styles.tabPane} ${tab === 'sent' ? styles.tabPaneActive : ''}`}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIllo}>📤</div>
            <p className={styles.emptyTitle}>Отправленных приглашений нет</p>
            <p className={styles.emptySub}>
              Приглашения, которые вы отправили участникам своих событий, будут отображаться здесь
            </p>
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

function InvitationCard({
  inv,
  onOpen,
  onPreview,
  onDecline,
  onLater,
}: {
  inv: IInvitation;
  onOpen: () => void;
  onPreview: () => void;
  onDecline: () => void;
  onLater: () => void;
}) {
  const event = inv.event;
  const types = getEventTypes(event);
  const params = getEventParams(event);
  const urgency = getEventUrgency(event.startTime);
  const unviewed = isInvitationUnviewed(inv);
  const coverBg = getEventCoverBackground(event as Parameters<typeof getEventCoverBackground>[0]);
  const fillPct = params.maxPersonsCount && params.participantsCount != null
    ? Math.min(100, Math.round((params.participantsCount / params.maxPersonsCount) * 100))
    : null;

  const urgClass = urgency?.kind === 'hot'
    ? styles.urgHot
    : urgency?.kind === 'soon'
      ? styles.urgSoon
      : styles.urgOk;

  return (
    <div
      className={[
        styles.invCard,
        urgency?.kind === 'hot' ? styles.invCardUrgent : '',
        unviewed ? styles.invCardUnviewed : '',
      ].filter(Boolean).join(' ')}
    >
      <div className={styles.invTop}>
        <div className={styles.invCover} style={{ background: coverBg }}>
          {event.coverImageId
            ? <AuthImage fileId={event.coverImageId} alt="" className={styles.invCoverImg} />
            : null}
          <div className={styles.invCoverOverlay} />
          {urgency && <span className={`${styles.urgBadge} ${urgClass}`}>{urgency.label}</span>}
        </div>

        <div className={styles.invInfo}>
          <div className={styles.inviterChip}>
            <UserAvatar
              accountId={inv.inviterAccountId}
              avatarId={inv.inviter?.account?.avatarId ?? null}
              initials={inviterInitials(inv)}
              size={22}
              className={styles.whoAvatar}
            />
            <span className={styles.inviterText}>
              <span className={styles.inviterName}>{inviterName(inv)}</span> приглашает вас
            </span>
            <span className={styles.invTime}>{formatRelativeInviteTime(inv.creationDate)}</span>
          </div>

          <button type="button" className={styles.invEventName} onClick={onOpen}>
            {event.name}
          </button>

          <div className={styles.invMeta}>
            <span className={styles.imeta}>📅 {formatInvitationEventDateShort(event.startTime)}</span>
            {event.address && (
              <>
                <span className={styles.idot} />
                <span className={styles.imeta}>📍 {event.address}</span>
              </>
            )}
            <span className={styles.idot} />
            <span className={`${styles.imeta} ${params.cost === 0 ? styles.priceFree : styles.pricePaid}`}>
              {params.cost === 0 ? 'Бесплатно' : `${params.cost.toLocaleString('ru-RU')} ₽`}
            </span>
            {params.ageLimit != null && params.ageLimit > 0 && (
              <>
                <span className={styles.idot} />
                <span className={styles.imeta}>{params.ageLimit}+</span>
              </>
            )}
          </div>

          {types.length > 0 && (
            <div className={styles.invChips}>
              {types.filter(Boolean).slice(0, 3).map(t => {
                const color = t.eventCategory?.color;
                return (
                  <span
                    key={t.id}
                    className={styles.ichip}
                    style={color ? {
                      background: `${color}20`,
                      border: `1px solid ${color}55`,
                      color,
                    } : undefined}
                  >
                    {t.ico && (
                      <img src={icoToUrl(t.ico) ?? undefined} alt="" width={10} height={10} style={{ objectFit: 'contain' }} />
                    )}
                    {t.name}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.invActions}>
          <button type="button" className={`${styles.actBtn} ${styles.actAccept}`} onClick={onPreview}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Принять
          </button>
          <button type="button" className={`${styles.actBtn} ${styles.actDecline}`} onClick={onDecline}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Отклонить
          </button>
          <button type="button" className={`${styles.actBtn} ${styles.actLater}`} onClick={onLater}>
            Позже
          </button>
        </div>
      </div>

      <div className={styles.invFooter}>
        <div className={styles.invFooterLeft}>
          {params.participantsCount != null && (
            <span className={styles.participantsMini}>
              {params.participantsCount} участник{params.participantsCount % 10 === 1 && params.participantsCount % 100 !== 11 ? '' : 'ов'}
              {params.private ? ' · приватное' : ''}
            </span>
          )}
          {fillPct != null && params.maxPersonsCount != null && params.participantsCount != null && (
            <div className={styles.fillMini}>
              <div className={styles.fillMiniBar}>
                <div className={styles.fillMiniInner} style={{ width: `${fillPct}%` }} />
              </div>
              <span>{params.participantsCount} / {params.maxPersonsCount} мест</span>
            </div>
          )}
        </div>
        <button type="button" className={styles.previewLink} onClick={onPreview}>
          Подробнее
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
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
          <div className={styles.dialogMeta}>
            <div className={styles.dmetaRow}>
              <div className={styles.dmetaIco}>📅</div>
              <div>
                <div className={styles.dmetaVal}>{formatInvitationEventDate(event.startTime)}</div>
                {daysLabel && <div className={styles.dmetaSub}>{daysLabel}</div>}
              </div>
            </div>
            {event.address && (
              <div className={styles.dmetaRow}>
                <div className={styles.dmetaIco}>📍</div>
                <div>
                  <div className={styles.dmetaVal}>{event.address}</div>
                </div>
              </div>
            )}
            <div className={styles.dmetaRow}>
              <div className={styles.dmetaIco}>🎫</div>
              <div>
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
            <button type="button" className={styles.dbtnAccept} onClick={onAccept}>✓ Принять приглашение</button>
          </div>
        </div>
      </div>
    </div>
  );
}
