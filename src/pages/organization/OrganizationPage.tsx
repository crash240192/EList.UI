// pages/organization/OrganizationPage.tsx
// Публичная страница организации — по структуре и оформлению как UserPage

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  OrganizationRole,
  OrganizationVerificationStatus,
  fetchOrganizationById,
  fetchOrganizationMembers,
  formatOrganizationRole,
  formatVerificationStatus,
  getOrganizationAvatar,
  getOrganizationAvatarHistory,
  organizationMemberAvatarId,
  organizationMemberDisplayName,
  organizationMemberInitials,
  type OrganizationMemberResponse,
  type OrganizationResponse,
} from '@/entities/organization';
import { EventList, EventListItem } from '@/entities/event/ui/EventListItem';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { getOrFetchAccountId, getStoredAccountId } from '@/entities/user/api';
import { useEvents } from '@/features/event-list/useEvents';
import { OrganizationShareMenu } from '@/features/organization/OrganizationShareMenu';
import { useAuthStore } from '@/app/store';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { AvatarLightbox } from '@/shared/ui/AvatarLightbox/AvatarLightbox';
import { HeroBackButton } from '@/shared/ui/HeroBackButton';
import { TabBar } from '@/shared/ui/TabBar';
import { usePageTitle } from '@/shared/hooks';
import { useSafeBack } from '@/shared/lib/useSafeBack';
import heroStyles from '@/shared/styles/hero.module.css';
import { isEventFinished } from '@/features/event/RatingWidget';
import type { IEvent } from '@/entities/event';
import styles from './OrganizationPage.module.css';

type EventsPhase = 'upcoming' | 'past';

function splitEventsByPhase(events: IEvent[], phase: EventsPhase): IEvent[] {
  const upcoming = events.filter(ev => !isEventFinished(ev.startTime, ev.endTime));
  const past = events.filter(ev => isEventFinished(ev.startTime, ev.endTime));
  const list = phase === 'upcoming' ? upcoming : past;

  return [...list].sort((a, b) => {
    const aTime = new Date(a.startTime).getTime();
    const bTime = new Date(b.startTime).getTime();
    return phase === 'upcoming' ? aTime - bTime : bTime - aTime;
  });
}

function verificationBadgeClass(
  status: OrganizationResponse['verificationStatus'],
): string {
  switch (status) {
    case OrganizationVerificationStatus.Verified: return styles.badgeOk;
    case OrganizationVerificationStatus.Pending: return styles.badgeWarn;
    case OrganizationVerificationStatus.Rejected: return styles.badgeErr;
    default: return styles.badgeMute;
  }
}

function OrgCoverBackground({ logoId }: { logoId: string | null }) {
  return (
    <div className={styles.coverBg}>
      <div className={styles.coverBgGradient} aria-hidden />
      {logoId ? (
        <AuthImage fileId={logoId} alt="" className={styles.coverAvatarImg} />
      ) : (
        <div className={styles.coverPattern} aria-hidden />
      )}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51 15.42 17.49" />
      <path d="m15.41 6.51-6.82 3.98" />
    </svg>
  );
}

export default function OrganizationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useSafeBack('/');
  const authenticated = useAuthStore(s => s.isAuthenticated());

  const [myAccountId, setMyAccountId] = useState<string | null>(getStoredAccountId());
  const [org, setOrg] = useState<OrganizationResponse | null>(null);
  const [members, setMembers] = useState<OrganizationMemberResponse[]>([]);
  const [logoId, setLogoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<'events'>('events');
  const [eventsPhase, setEventsPhase] = useState<EventsPhase>('upcoming');
  const [lightboxFileIds, setLightboxFileIds] = useState<string[] | null>(null);
  const [showShareMenu, setShowShareMenu] = useState(false);

  useEffect(() => {
    if (!authenticated || myAccountId) return;
    getOrFetchAccountId().then(setMyAccountId).catch(() => {});
  }, [authenticated, myAccountId]);

  useEffect(() => {
    if (!id) {
      setError('Организация не найдена');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      fetchOrganizationById(id),
      fetchOrganizationMembers(id).catch(() => [] as OrganizationMemberResponse[]),
      getOrganizationAvatar(id),
    ])
      .then(([o, m, av]) => {
        setOrg(o);
        setMembers(m.length ? m : (o.members ?? []));
        setLogoId(av);
      })
      .catch(e => {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
        setOrg(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const orgEvents = useEvents(
    { organizationId: id },
    !!id,
  );

  const filteredEvents = useMemo(
    () => splitEventsByPhase(orgEvents.events, eventsPhase),
    [orgEvents.events, eventsPhase],
  );

  const myRole = useMemo(() => {
    if (!myAccountId) return null;
    return members.find(m => m.accountId === myAccountId)?.role ?? null;
  }, [members, myAccountId]);

  const canManage =
    myRole === OrganizationRole.Owner || myRole === OrganizationRole.Manager;

  const initials = (org?.name ?? 'Орг').slice(0, 2).toUpperCase();
  usePageTitle(org?.name ?? null);

  const openLogoLightbox = useCallback(async () => {
    if (!id) return;
    const history = await getOrganizationAvatarHistory(id);
    const ids = history.filter(Boolean);
    if (ids.length) setLightboxFileIds(ids);
    else if (logoId) setLightboxFileIds([logoId]);
  }, [id, logoId]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.cover} />
          <div className={styles.skeletonBody}>
            <div className={styles.skeletonLine} style={{ width: '40%' }} />
            <div className={styles.skeletonLine} style={{ width: '70%' }} />
            <div className={styles.skeletonLine} style={{ width: '55%' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className={styles.errorState}>
        <p>{error ?? 'Организация не найдена'}</p>
        <button type="button" onClick={goBack}>← Назад</button>
      </div>
    );
  }

  const activeMembers = members.filter(m => m.active !== false);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.cover}>
          <OrgCoverBackground logoId={logoId} />
          <div className={styles.coverOverlay} />
          <div className={styles.heroTop}>
            <HeroBackButton onClick={goBack} />
            <div className={styles.heroTopRight}>
              <button
                type="button"
                className={`${heroStyles.heroBtn} noHoverGlow`}
                onClick={() => setShowShareMenu(true)}
                aria-label="Поделиться"
                title="Поделиться"
              >
                <ShareIcon />
              </button>
            </div>
          </div>
        </div>

        <div className={styles.profileHeader}>
          <button
            type="button"
            className={styles.avatarWrap}
            onClick={() => { void openLogoLightbox(); }}
            aria-label="Открыть логотип"
          >
            <div className={styles.avatar}>
              {logoId ? (
                <AuthImage fileId={logoId} alt={org.name} className={styles.avatarImg} />
              ) : (
                <span>{initials}</span>
              )}
            </div>
          </button>

          <div className={styles.profileInfo}>
            <div className={styles.nameRow}>
              <h1 className={styles.fullName}>{org.name}</h1>
              <span className={`${styles.badge} ${verificationBadgeClass(org.verificationStatus)}`}>
                {formatVerificationStatus(org.verificationStatus)}
              </span>
              {!org.active && (
                <span className={`${styles.badge} ${styles.badgeMute}`}>Неактивна</span>
              )}
            </div>
            <div className={styles.loginLine}>Организация</div>
            {(org.address || org.canSellTickets) && (
              <div className={styles.profileMeta}>
                {org.address && <span>{org.address}</span>}
                {org.address && org.canSellTickets && (
                  <span className={styles.profileMetaDot} aria-hidden>·</span>
                )}
                {org.canSellTickets && <span>Продажа билетов</span>}
              </div>
            )}
          </div>

          {canManage && (
            <div className={styles.profileActions}>
              <button
                type="button"
                className={styles.btnJoin}
                onClick={() => navigate('/settings')}
              >
                Управление
              </button>
            </div>
          )}
        </div>

        <div className={styles.statsBar}>
          <div className={styles.statGroup}>
            <div className={`${styles.statItem} ${styles.statItemActive}`}>
              <span className={styles.statNum}>
                {orgEvents.total || orgEvents.events.length}
              </span>
              <span className={styles.statLabel}>события</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>{activeMembers.length}</span>
              <span className={styles.statLabel}>команда</span>
            </div>
          </div>

          <div className={styles.statGroupDivider} aria-hidden />

          <div className={styles.statGroup}>
            <div className={styles.statItem}>
              <span className={styles.statNum}>{org.canSellTickets ? 'Да' : 'Нет'}</span>
              <span className={styles.statLabel}>билеты</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>
                {org.verificationStatus === OrganizationVerificationStatus.Verified ? 'Да' : 'Нет'}
              </span>
              <span className={styles.statLabel}>верификация</span>
            </div>
          </div>
        </div>

        <div className={styles.mainGrid}>
          <aside className={styles.leftPanel}>
            {org.description?.trim() && (
              <section>
                <div className={styles.secLabel}>Описание</div>
                <p className={styles.aboutText}>{org.description.trim()}</p>
              </section>
            )}

            {org.address && (
              <>
                {org.description?.trim() && <div className={styles.sectionDivider} />}
                <section>
                  <div className={styles.secLabel}>Адрес</div>
                  <p className={styles.addressText}>{org.address}</p>
                </section>
              </>
            )}

            {activeMembers.length > 0 && (
              <>
                {(org.description?.trim() || org.address) && (
                  <div className={styles.sectionDivider} />
                )}
                <section>
                  <div className={styles.secLabel}>Команда</div>
                  <div className={styles.memberList}>
                    {activeMembers.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        className={styles.memberRow}
                        onClick={() => navigate(`/user/${m.accountId}`)}
                      >
                        <UserAvatar
                          accountId={m.accountId}
                          avatarId={organizationMemberAvatarId(m)}
                          initials={organizationMemberInitials(m)}
                          size={36}
                        />
                        <div className={styles.memberInfo}>
                          <span className={styles.memberName}>
                            {organizationMemberDisplayName(m)}
                          </span>
                          <span className={styles.memberRole}>
                            {formatOrganizationRole(m.role)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}
          </aside>

          <section className={styles.rightPanel}>
            <TabBar
              tabs={[
                {
                  id: 'events',
                  label: 'События',
                  count: orgEvents.total || orgEvents.events.length,
                },
              ]}
              activeId={mainTab}
              onChange={() => setMainTab('events')}
            />

            <div className={styles.tabContent}>
              <TabBar
                variant="pill"
                className={styles.phaseTabs}
                tabs={[
                  { id: 'upcoming', label: 'Предстоящие' },
                  { id: 'past', label: 'Прошедшие' },
                ]}
                activeId={eventsPhase}
                onChange={phaseId => setEventsPhase(phaseId as EventsPhase)}
              />

              {orgEvents.isLoading && (
                <div className={styles.emptyEvents}>Загрузка...</div>
              )}

              {!orgEvents.isLoading && filteredEvents.length === 0 && (
                <p className={styles.emptyEvents}>
                  {eventsPhase === 'upcoming'
                    ? 'Нет предстоящих мероприятий'
                    : 'Нет прошедших мероприятий'}
                </p>
              )}

              {!orgEvents.isLoading && filteredEvents.length > 0 && (
                <EventList>
                  {filteredEvents.map(event => (
                    <EventListItem
                      key={event.id}
                      event={event}
                      onClick={() => navigate(`/event/${event.id}`)}
                      bleedCover
                    />
                  ))}
                </EventList>
              )}
            </div>
          </section>
        </div>
      </div>

      {lightboxFileIds && lightboxFileIds.length > 0 && (
        <AvatarLightbox
          fileIds={lightboxFileIds}
          initials={initials}
          onClose={() => setLightboxFileIds(null)}
          canDelete={false}
        />
      )}

      {showShareMenu && (
        <OrganizationShareMenu
          organizationId={org.id}
          name={org.name}
          onClose={() => setShowShareMenu(false)}
        />
      )}
    </div>
  );
}
