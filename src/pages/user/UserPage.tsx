// pages/user/UserPage.tsx — профиль пользователя (макет examples/elist_user_page.html)

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { IEvent } from '@/entities/event';
import { fetchOrganizerRating } from '@/entities/event';
import { getStoredAccountId, getOrFetchAccountId } from '@/entities/user/api';
import { fetchFullProfile } from '@/entities/user/profileApi';
import type { IFullProfile, IContactDataItem } from '@/entities/user/profileApi';
import { useEvents } from '@/features/event-list/useEvents';
import {
  fetchSubscriptionsCount,
  fetchSubscribersCount,
  fetchSubscriptions,
  subscribe,
  unsubscribe,
  type INotifySettings,
} from '@/entities/user/subscriptionApi';
import { SubscribeModal } from '@/features/subscriptions/SubscribeModal';
import { SubscribersListModal } from '@/features/subscriptions/SubscribersListModal';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { AvatarLightbox } from '@/shared/ui/AvatarLightbox/AvatarLightbox';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { useAvatar } from '@/features/auth/useAvatar';
import { getAvatarHistory } from '@/entities/user/avatarApi';
import { EventListItem, EventList } from '@/entities/event/ui/EventListItem';
import { EventAlbumsGroupsPanel } from '@/features/media/EventAlbumsGroupsPanel';
import { GradeBadge } from '@/shared/ui/GradeBadge/GradeBadge';
import { TabBar } from '@/shared/ui/TabBar';
import { HeroBackButton } from '@/shared/ui/HeroBackButton';
import { useAuthStore } from '@/app/store';
import { buildUserProfileUrl, canUseNativeShare, shareLink } from '@/shared/lib/shareLink';
import { useToastStore } from '@/app/store';
import heroStyles from '@/shared/styles/hero.module.css';
import {
  countUniqueUserEvents,
  formatContactHref,
  formatShortEventDate,
  getContactIconKind,
  getUpcomingPreview,
  isContactLink,
  mergeUserEvents,
  splitEventsByPhase,
  type ContactIconKind,
  type UserEventsPhase,
  type UserEventsScope,
} from './userPageUtils';
import styles from './UserPage.module.css';

type MainTab = UserEventsScope | 'albums';
type ListModal = 'subscriptions' | 'subscribers' | null;

const SCOPE_TABS: { key: UserEventsScope; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'created', label: 'Организует' },
  { key: 'participating', label: 'Участвует' },
];

const MAIN_TABS: { key: MainTab; label: string }[] = [
  ...SCOPE_TABS,
  { key: 'albums', label: 'Альбомы' },
];

function UserCoverBackground({
  accountId,
  avatarId,
}: {
  accountId: string;
  avatarId: string | null;
}) {
  const fileId = useAvatar(accountId, avatarId);

  return (
    <div className={styles.coverBg}>
      <div className={styles.coverBgGradient} aria-hidden />
      {fileId ? (
        <AuthImage
          fileId={fileId}
          alt=""
          className={styles.coverAvatarImg}
        />
      ) : (
        <div className={styles.coverPattern} aria-hidden />
      )}
    </div>
  );
}

function ContactIcon({ kind }: { kind: ContactIconKind }) {
  const svgProps = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (kind) {
    case 'email':
      return (
        <svg {...svgProps}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a2 2 0 0 1-2.06 0L2 7" />
        </svg>
      );
    case 'telegram':
      return (
        <svg {...svgProps}>
          <path d="M22 2 11 13" />
          <path d="m22 2-7 20-4-9-9-4z" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...svgProps}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      );
    case 'site':
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case 'location':
      return (
        <svg {...svgProps}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    default:
      return (
        <svg {...svgProps}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
  }
}

function ContactRow({ contact }: { contact: IContactDataItem }) {
  const label = contact.contactType?.name
    ?? contact.contactType?.localizedName
    ?? 'Контакт';
  const href = formatContactHref(contact);
  const linked = isContactLink(contact);

  return (
    <div className={styles.contactRow}>
      <div className={styles.contactIco} aria-hidden>
        <ContactIcon kind={getContactIconKind(contact)} />
      </div>
      <div className={styles.contactBody}>
        <div className={styles.contactLabel}>{label}</div>
        {linked && href ? (
          <a className={styles.contactLink} href={href} target="_blank" rel="noreferrer noopener">
            {contact.value}
          </a>
        ) : (
          <div className={styles.contactVal}>{contact.value}</div>
        )}
      </div>
    </div>
  );
}

function UserEventsPanel({
  events,
  total,
  isLoading,
  scope,
  phase,
  onPhaseChange,
  onOpen,
}: {
  events: IEvent[];
  total: number;
  isLoading: boolean;
  scope: UserEventsScope;
  phase: UserEventsPhase;
  onPhaseChange: (phase: UserEventsPhase) => void;
  onOpen: (eventId: string) => void;
}) {
  const filtered = useMemo(() => splitEventsByPhase(events, phase), [events, phase]);

  return (
    <div className={styles.tabContent}>
      <div className={styles.subtabs}>
        <TabBar
          variant="pill"
          className={styles.phaseTabs}
          tabs={[
            { id: 'upcoming', label: 'Предстоящие' },
            { id: 'past', label: 'Прошедшие' },
          ]}
          activeId={phase}
          onChange={id => onPhaseChange(id as UserEventsPhase)}
        />
      </div>

      {isLoading && (
        <div className={styles.eventSkeletons}>
          {[1, 2, 3].map(i => <div key={i} className={styles.eventSkeleton} />)}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <p className={styles.placeholder}>
          {scope === 'all'
            ? (phase === 'upcoming' ? 'Нет предстоящих мероприятий' : 'Нет прошедших мероприятий')
            : scope === 'created'
              ? (phase === 'upcoming' ? 'Нет предстоящих организованных мероприятий' : 'Нет прошедших организованных мероприятий')
              : (phase === 'upcoming' ? 'Нет предстоящих мероприятий с участием' : 'Нет прошедших мероприятий с участием')}
        </p>
      )}

      {!isLoading && filtered.length > 0 && (
        <EventList className={styles.eventsList}>
          {filtered.map(event => (
            <EventListItem
              key={event.id}
              event={event}
              onClick={() => onOpen(event.id)}
            />
          ))}
        </EventList>
      )}

      {!isLoading && total > events.length && filtered.length > 0 && (
        <p className={styles.moreHint}>Показано {events.length} из {total}</p>
      )}
    </div>
  );
}

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const authenticated = useAuthStore(s => s.isAuthenticated());

  useEffect(() => {
    if (!authenticated && (id === 'me' || !id)) {
      navigate('/login', { replace: true, state: { from: `/user/${id ?? 'me'}` } });
    }
  }, [authenticated, id, navigate]);

  const [myAccountId, setMyAccountId] = useState<string | null>(getStoredAccountId());
  useEffect(() => {
    if (!authenticated || myAccountId) return;
    getOrFetchAccountId().then(setMyAccountId).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  const isOwnProfile = !id || id === 'me' || id === myAccountId;
  const targetId = isOwnProfile ? null : id;
  const profileAccountId = isOwnProfile ? (myAccountId ?? '') : (id ?? '');

  const [profile, setProfile] = useState<IFullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>('all');
  const [albumsCount, setAlbumsCount] = useState(0);
  const [organizerRating, setOrganizerRating] = useState<number | null>(null);
  const [eventsPhase, setEventsPhase] = useState<UserEventsPhase>('upcoming');
  const [subsCount, setSubsCount] = useState(0);
  const [subscrCount, setSubscrCount] = useState(0);
  const [listModal, setListModal] = useState<ListModal>(null);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [lightboxFileIds, setLightboxFileIds] = useState<string[] | null>(null);

  const createdEvents = useEvents(
    { organizatorId: profileAccountId },
    !!profileAccountId,
  );
  const participatingEvents = useEvents(
    { participantId: profileAccountId },
    !!profileAccountId,
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchFullProfile(targetId)
      .then(setProfile)
      .catch(e => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [targetId]);

  useEffect(() => {
    if (!profileAccountId) return;
    Promise.all([
      fetchSubscriptionsCount(profileAccountId),
      fetchSubscribersCount(profileAccountId),
    ]).then(([s, sc]) => {
      setSubsCount(s);
      setSubscrCount(sc);
    });
  }, [profileAccountId]);

  useEffect(() => {
    if (!profileAccountId) return;
    fetchOrganizerRating(profileAccountId)
      .then(setOrganizerRating)
      .catch(() => setOrganizerRating(null));
  }, [profileAccountId]);

  useEffect(() => {
    if (!profileAccountId || !myAccountId || isOwnProfile) return;
    fetchSubscriptions(myAccountId, { pageSize: 200 })
      .then(page => {
        setIsSubscribed(page.items.some((s: { account: { id: string } }) => s.account.id === profileAccountId));
      })
      .catch(() => {});
  }, [profileAccountId, myAccountId, isOwnProfile]);

  const handleSubscribe = useCallback(async (settings: INotifySettings) => {
    if (!profileAccountId) return;
    await subscribe(profileAccountId, settings);
    setIsSubscribed(true);
    setSubscrCount(c => c + 1);
    setShowSubscribe(false);
  }, [profileAccountId]);

  const handleUnsubscribe = useCallback(async () => {
    if (!profileAccountId) return;
    await unsubscribe(profileAccountId);
    setIsSubscribed(false);
    setSubscrCount(c => Math.max(0, c - 1));
  }, [profileAccountId]);

  const handleShare = useCallback(() => {
    if (!profile?.account?.id) return;

    const { account } = profile;
    const url = buildUserProfileUrl(account.id);

    void shareLink({
      title: `Профиль @${account.login}`,
      text: `Профиль @${account.login}`,
      url,
    })
      .then((result) => {
        const copiedMsg = canUseNativeShare()
          ? 'Ссылка скопирована в буфер обмена'
          : 'Ссылка скопирована (нужен HTTPS для системного шаринга)';
        useToastStore.getState().add(
          result === 'shared' ? 'Ссылка отправлена' : copiedMsg,
          'success',
        );
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        useToastStore.getState().add('Не удалось поделиться ссылкой', 'error');
      });
  }, [profile]);

  const allEvents = useMemo(
    () => mergeUserEvents(createdEvents.events, participatingEvents.events),
    [createdEvents.events, participatingEvents.events],
  );
  const allEventsTotal = useMemo(
    () => countUniqueUserEvents(createdEvents.events, participatingEvents.events),
    [createdEvents.events, participatingEvents.events],
  );

  const activeEvents = mainTab === 'all'
    ? { events: allEvents, total: allEventsTotal, isLoading: createdEvents.isLoading || participatingEvents.isLoading }
    : mainTab === 'created'
      ? createdEvents
      : mainTab === 'participating'
        ? participatingEvents
        : { events: [], total: 0, isLoading: false };

  const tabCounts: Record<MainTab, number> = {
    all: allEventsTotal || allEvents.length,
    created: createdEvents.total || createdEvents.events.length,
    participating: participatingEvents.total || participatingEvents.events.length,
    albums: albumsCount,
  };

  const upcomingPreview = useMemo(() => {
    const created = getUpcomingPreview(createdEvents.events, 'created', 2);
    const participating = getUpcomingPreview(participatingEvents.events, 'participating', 2);
    return [...created, ...participating]
      .sort((a, b) => new Date(a.event.startTime).getTime() - new Date(b.event.startTime).getTime())
      .slice(0, 3);
  }, [createdEvents.events, participatingEvents.events]);

  if (loading) return <Skeleton />;
  if (error || !profile) {
    return (
      <div className={styles.errorState}>
        <p>{error ?? 'Пользователь не найден'}</p>
        <button type="button" onClick={() => navigate(-1)}>← Назад</button>
      </div>
    );
  }

  const { account, contacts, person } = profile;
  const fullName = [person?.lastName, person?.firstName].filter(Boolean).join(' ');
  const age = person?.birthDate
    ? Math.floor((Date.now() - new Date(person.birthDate).getTime()) / 31_557_600_000)
    : null;
  const visibleContacts = contacts.filter(c => isOwnProfile || c.show);
  const initials = (fullName || account.login).slice(0, 2).toUpperCase();

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.cover}>
          <UserCoverBackground
            accountId={profileAccountId}
            avatarId={account.avatarId ?? null}
          />
          <div className={styles.coverOverlay} />

          <div className={styles.heroTop}>
            <HeroBackButton onClick={() => navigate(-1)} />
            <div className={styles.heroTopRight}>
              <button
                type="button"
                className={`${heroStyles.heroBtn} noHoverGlow`}
                onClick={() => void handleShare()}
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
            onClick={async () => {
              const history = await getAvatarHistory(profileAccountId);
              setLightboxFileIds(
                history
                  .map(h => (typeof h === 'string' ? h : (h as { fileId?: string; id?: string }).fileId ?? (h as { id?: string }).id))
                  .filter(Boolean) as string[],
              );
            }}
            aria-label="Открыть фото профиля"
          >
            <UserAvatar
              accountId={profileAccountId}
              avatarId={account.avatarId ?? null}
              initials={initials}
              size={88}
              className={styles.avatar}
            />
          </button>

          <div className={styles.profileInfo}>
            <div className={styles.nameRow}>
              {fullName && <h1 className={styles.fullName}>{fullName}</h1>}
            </div>
            <div className={styles.loginLine}>@{account.login}</div>
            {(age !== null || person?.gender) && (
              <div className={styles.profileMeta}>
                {age !== null && <span>{age} лет</span>}
                {age !== null && person?.gender && <span className={styles.profileMetaDot} aria-hidden>·</span>}
                {person?.gender && <span>{person.gender === 'Male' ? 'Мужской' : 'Женский'}</span>}
              </div>
            )}
          </div>

          {!isOwnProfile && authenticated && (
            <div className={styles.profileActions}>
              {isSubscribed ? (
                <button type="button" className={`${styles.btnJoin} ${styles.btnLeave}`} onClick={() => void handleUnsubscribe()}>
                  Отписаться
                </button>
              ) : (
                <button type="button" className={styles.btnJoin} onClick={() => setShowSubscribe(true)}>
                  Подписаться
                </button>
              )}
            </div>
          )}
        </div>

        <div className={styles.statsBar}>
          <div className={styles.statGroup}>
            <button
              type="button"
              className={`${styles.statItem} ${mainTab === 'created' ? styles.statItemActive : ''}`}
              onClick={() => { setMainTab('created'); }}
            >
              <span className={styles.statNum}>{createdEvents.total || createdEvents.events.length}</span>
              <span className={styles.statLabel}>организовал</span>
            </button>
            <button
              type="button"
              className={`${styles.statItem} ${mainTab === 'participating' ? styles.statItemActive : ''}`}
              onClick={() => { setMainTab('participating'); }}
            >
              <span className={styles.statNum}>{participatingEvents.total || participatingEvents.events.length}</span>
              <span className={styles.statLabel}>посетил</span>
            </button>
          </div>

          <div className={styles.statGroupDivider} aria-hidden />

          <div className={styles.statGroup}>
            <button
              type="button"
              className={`${styles.statItem} ${listModal === 'subscribers' ? styles.statItemActive : ''}`}
              onClick={() => setListModal('subscribers')}
            >
              <span className={styles.statNum}>{subscrCount}</span>
              <span className={styles.statLabel}>подписчики</span>
            </button>
            <button
              type="button"
              className={`${styles.statItem} ${listModal === 'subscriptions' ? styles.statItemActive : ''}`}
              onClick={() => setListModal('subscriptions')}
            >
              <span className={styles.statNum}>{subsCount}</span>
              <span className={styles.statLabel}>подписки</span>
            </button>
          </div>

          <div className={`${styles.statItem} ${styles.statItemStatic} ${styles.statItemRating}`}>
            <div className={styles.statRating}>
              {organizerRating != null && organizerRating > 0 ? (
                <>
                  <GradeBadge score={organizerRating} size="sm" />
                  <span className={styles.ratingNum}>{organizerRating.toFixed(1)}</span>
                </>
              ) : (
                <span className={styles.statNum}>—</span>
              )}
            </div>
            <span className={styles.statLabel}>рейтинг организатора</span>
          </div>
        </div>

        <div className={styles.mainGrid}>
          <aside className={styles.leftPanel}>
            {visibleContacts.length > 0 && (
              <section>
                <div className={styles.secLabel}>Контакты</div>
                <div className={styles.contactList}>
                  {visibleContacts.map(contact => (
                    <ContactRow key={contact.id} contact={contact} />
                  ))}
                </div>
              </section>
            )}

            {upcomingPreview.length > 0 && (
              <>
                {visibleContacts.length > 0 && <div className={styles.sectionDivider} />}
                <section>
                  <div className={styles.secLabel}>Ближайшие события</div>
                  <div className={styles.upcomingList}>
                    {upcomingPreview.map(({ event, scope }, index) => (
                      <button
                        key={`${event.id}-${scope}`}
                        type="button"
                        className={styles.nextEvent}
                        onClick={() => navigate(`/event/${event.id}`)}
                      >
                        <div className={styles.neDotCol}>
                          <span
                            className={styles.neDot}
                            style={{ background: scope === 'created' ? 'var(--accent)' : '#22c55e' }}
                            aria-hidden
                          />
                          {index < upcomingPreview.length - 1 && <span className={styles.neLine} aria-hidden />}
                        </div>
                        <div className={styles.neInfo}>
                          <div className={styles.neDate}>{formatShortEventDate(event.startTime)}</div>
                          <div className={styles.neName}>{event.name}</div>
                          <div className={styles.neMeta}>
                            {event.address && <span>{event.address}</span>}
                            {event.address && <span> · </span>}
                            <span className={scope === 'created' ? styles.neBadgeOrganizer : styles.neBadgeParticipant}>
                              {scope === 'created' ? 'Организую' : 'Участвую'}
                            </span>
                          </div>
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
              tabs={MAIN_TABS.map(tab => ({
                id: tab.key,
                label: tab.label,
                count: tabCounts[tab.key],
              }))}
              activeId={mainTab}
              onChange={id => setMainTab(id as MainTab)}
            />

            {mainTab === 'albums' ? (
              <div className={styles.tabContent}>
                <EventAlbumsGroupsPanel
                  accountId={profileAccountId}
                  onOpenEvent={eventId => navigate(`/event/${eventId}`)}
                  onTotalChange={setAlbumsCount}
                />
              </div>
            ) : (
              <UserEventsPanel
                events={activeEvents.events}
                total={activeEvents.total}
                isLoading={activeEvents.isLoading}
                scope={mainTab}
                phase={eventsPhase}
                onPhaseChange={setEventsPhase}
                onOpen={eventId => navigate(`/event/${eventId}`)}
              />
            )}
          </section>
        </div>
      </div>

      {showSubscribe && (
        <SubscribeModal
          targetLogin={account.login}
          targetAccountId={account.id}
          targetAvatarId={account.avatarId ?? null}
          onConfirm={handleSubscribe}
          onCancel={() => setShowSubscribe(false)}
        />
      )}
      {listModal === 'subscriptions' && (
        <SubscribersListModal
          title="Подписки"
          accountId={profileAccountId}
          listType="subscriptions"
          currentAccountId={myAccountId}
          onClose={() => setListModal(null)}
        />
      )}
      {listModal === 'subscribers' && (
        <SubscribersListModal
          title="Подписчики"
          accountId={profileAccountId}
          listType="subscribers"
          currentAccountId={myAccountId}
          onClose={() => setListModal(null)}
        />
      )}

      {lightboxFileIds && lightboxFileIds.length > 0 && (
        <AvatarLightbox
          fileIds={lightboxFileIds}
          initials={initials}
          onClose={() => setLightboxFileIds(null)}
        />
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.cover} />
        <div className={styles.skeletonBody}>
          <div className={styles.skeletonAvatar} />
          <div className={styles.skeletonLine} />
          <div className={styles.skeletonLineShort} />
        </div>
      </div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
