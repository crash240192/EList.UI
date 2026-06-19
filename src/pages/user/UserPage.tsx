// pages/user/UserPage.tsx — профиль пользователя (макет examples/elist_user_page.html)

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { IEvent } from '@/entities/event';
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
import { UserShareMenu } from '@/features/user/UserShareMenu';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { AvatarLightbox } from '@/shared/ui/AvatarLightbox/AvatarLightbox';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { getAvatarHistory } from '@/entities/user/avatarApi';
import { icoToUrl } from '@/shared/lib/icoToUrl';
import {
  contrastColor,
  countUniqueUserEvents,
  formatContactHref,
  formatEventListDate,
  formatEventPrice,
  formatShortEventDate,
  getContactIconKind,
  getEventCoverStyle,
  getEventTypes,
  getUpcomingPreview,
  isContactLink,
  mergeUserEvents,
  splitEventsByPhase,
  type ContactIconKind,
  type UserEventsPhase,
  type UserEventsScope,
} from './userPageUtils';
import styles from './UserPage.module.css';

type MainTab = UserEventsScope;
type ListModal = 'subscriptions' | 'subscribers' | null;

const SCOPE_TABS: { key: MainTab; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'created', label: 'Организует' },
  { key: 'participating', label: 'Участвует' },
];

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

function EventCoverThumb({ event }: { event: IEvent }) {
  return (
    <div className={styles.ecCover} style={{ background: getEventCoverStyle(event) }}>
      {event.coverImageId ? (
        <AuthImage
          fileId={event.coverImageId}
          alt=""
          className={styles.ecCoverImg}
          fallback={
            event.coverUrl
              ? <img src={event.coverUrl} alt="" className={styles.ecCoverImg} />
              : undefined
          }
        />
      ) : event.coverUrl ? (
        <img src={event.coverUrl} alt="" className={styles.ecCoverImg} />
      ) : (
        <span className={styles.ecCoverFallback} aria-hidden>📅</span>
      )}
    </div>
  );
}

function UserEventCard({
  event,
  onClick,
}: {
  event: IEvent;
  onClick: () => void;
}) {
  const cost = event.parameters?.cost ?? 0;
  const age = event.parameters?.ageLimit;
  const price = formatEventPrice(cost);
  const types = getEventTypes(event);

  return (
    <button type="button" className={styles.eventCard} onClick={onClick}>
      <EventCoverThumb event={event} />
      <div className={styles.ecInfo}>
        <div className={styles.ecTop}>
          <div className={styles.ecName}>{event.name}</div>
          <div className={`${styles.ecPrice} ${price.free ? styles.ecPriceFree : styles.ecPricePaid}`}>
            {price.label}
          </div>
        </div>
        <div className={styles.ecMeta}>
          {event.startTime && <span>{formatEventListDate(event.startTime)}</span>}
          {event.address && (
            <>
              <span className={styles.ecDot} aria-hidden />
              <span>{event.address}</span>
            </>
          )}
          {age != null && age > 0 && (
            <>
              <span className={styles.ecDot} aria-hidden />
              <span>{age}+</span>
            </>
          )}
        </div>
        {types.length > 0 && (
          <div className={styles.ecTags}>
            {types.map(t => {
              const catColor = t.eventCategory?.color ?? '#6366f1';
              return (
                <span
                  key={t.id}
                  className={styles.ecTypeTag}
                  style={{
                    background: `${catColor}55`,
                    border: `1px solid ${catColor}99`,
                    color: contrastColor(catColor),
                  }}
                >
                  {t.ico && (
                    <img
                      src={icoToUrl(t.ico) ?? ''}
                      alt=""
                      width={10}
                      height={10}
                      className={styles.ecTypeIco}
                    />
                  )}
                  {t.name}
                </span>
              );
            })}
          </div>
        )}
        {event.participantsCount != null && (
          <div className={styles.ecStats}>
            <span className={styles.ecStat}>
              <PeopleIcon />
              {event.participantsCount}
              {event.parameters?.maxPersonsCount ? ` / ${event.parameters.maxPersonsCount}` : ''} участников
            </span>
          </div>
        )}
      </div>
    </button>
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
        <button
          type="button"
          className={`${styles.stab} ${phase === 'upcoming' ? styles.stabActive : ''}`}
          onClick={() => onPhaseChange('upcoming')}
        >
          Предстоящие
        </button>
        <button
          type="button"
          className={`${styles.stab} ${phase === 'past' ? styles.stabActive : ''}`}
          onClick={() => onPhaseChange('past')}
        >
          Прошедшие
        </button>
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

      {!isLoading && filtered.map(event => (
        <UserEventCard
          key={event.id}
          event={event}
          onClick={() => onOpen(event.id)}
        />
      ))}

      {!isLoading && total > events.length && filtered.length > 0 && (
        <p className={styles.moreHint}>Показано {events.length} из {total}</p>
      )}
    </div>
  );
}

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [myAccountId, setMyAccountId] = useState<string | null>(getStoredAccountId());
  useEffect(() => {
    if (!myAccountId) getOrFetchAccountId().then(setMyAccountId).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isOwnProfile = !id || id === 'me' || id === myAccountId;
  const targetId = isOwnProfile ? null : id;
  const profileAccountId = isOwnProfile ? (myAccountId ?? '') : (id ?? '');

  const [profile, setProfile] = useState<IFullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>('all');
  const [eventsPhase, setEventsPhase] = useState<UserEventsPhase>('upcoming');
  const [subsCount, setSubsCount] = useState(0);
  const [subscrCount, setSubscrCount] = useState(0);
  const [listModal, setListModal] = useState<ListModal>(null);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [lightboxFileIds, setLightboxFileIds] = useState<string[] | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
      : participatingEvents;

  const scopeCounts: Record<MainTab, number> = {
    all: allEventsTotal || allEvents.length,
    created: createdEvents.total || createdEvents.events.length,
    participating: participatingEvents.total || participatingEvents.events.length,
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
        <span>😕</span>
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
          <div className={styles.coverBg}>
            <div className={styles.coverPattern} />
          </div>
          <div className={styles.coverOverlay} />

          <div className={styles.heroTop}>
            <button type="button" className={styles.heroBtn} onClick={() => navigate(-1)} aria-label="Назад">
              <ChevronLeft />
            </button>
            <div className={styles.heroTopRight}>
              <div className={styles.menuWrap}>
                <button
                  type="button"
                  className={styles.heroBtn}
                  onClick={() => setMenuOpen(v => !v)}
                  aria-label="Меню"
                  aria-expanded={menuOpen}
                >
                  <MenuIcon />
                </button>
                {menuOpen && (
                  <>
                    <div className={styles.menuBackdrop} onClick={() => setMenuOpen(false)} />
                    <div className={styles.menu} role="menu">
                      {isOwnProfile && (
                        <button
                          type="button"
                          className={styles.menuItem}
                          role="menuitem"
                          onClick={() => { navigate('/settings'); setMenuOpen(false); }}
                        >
                          ✏️ Редактировать
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.menuItem}
                        role="menuitem"
                        onClick={() => { setShareOpen(true); setMenuOpen(false); }}
                      >
                        🔗 Поделиться
                      </button>
                    </div>
                  </>
                )}
              </div>
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

          {!isOwnProfile && (
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
          <button type="button" className={styles.statItem} onClick={() => { setMainTab('created'); }}>
            <span className={styles.statNum}>{createdEvents.total || createdEvents.events.length}</span>
            <span className={styles.statLabel}>организовал</span>
          </button>
          <button type="button" className={styles.statItem} onClick={() => { setMainTab('participating'); }}>
            <span className={styles.statNum}>{participatingEvents.total || participatingEvents.events.length}</span>
            <span className={styles.statLabel}>посетил</span>
          </button>
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
            <div className={styles.tabsBar}>
              {SCOPE_TABS.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  className={`${styles.tabBtn} ${mainTab === tab.key ? styles.tabBtnActive : ''}`}
                  onClick={() => setMainTab(tab.key)}
                >
                  {tab.label}
                  <span className={styles.tabCnt}>{scopeCounts[tab.key]}</span>
                </button>
              ))}
            </div>

            <UserEventsPanel
              events={activeEvents.events}
              total={activeEvents.total}
              isLoading={activeEvents.isLoading}
              scope={mainTab}
              phase={eventsPhase}
              onPhaseChange={setEventsPhase}
              onOpen={eventId => navigate(`/event/${eventId}`)}
            />
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
      {shareOpen && account.id && (
        <UserShareMenu
          accountId={account.id}
          login={account.login}
          onClose={() => setShareOpen(false)}
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

function ChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
