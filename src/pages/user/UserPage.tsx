// pages/user/UserPage.tsx — редизайн в стиле страницы события

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { IEvent } from '@/entities/event';
import { useAuthStore } from '@/app/store';
import { getStoredAccountId } from '@/entities/user/api';
import { fetchFullProfile } from '@/entities/user/profileApi';
import type { IFullProfile, IContactDataItem } from '@/entities/user/profileApi';
import { useEvents } from '@/features/event-list/useEvents';
import { useFavoritesStore } from '@/app/store';
import {
  fetchSubscriptionsCount, fetchSubscribersCount,
  fetchSubscriptions, fetchSubscribers,
  subscribe, unsubscribe,
  type INotifySettings,
} from '@/entities/user/subscriptionApi';
import { SubscribeModal } from '@/features/subscriptions/SubscribeModal';
import { SubscribersListModal } from '@/features/subscriptions/SubscribersListModal';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { AvatarLightbox } from '@/shared/ui/AvatarLightbox/AvatarLightbox';
import { getAvatarHistory } from '@/entities/user/avatarApi';
import styles from './UserPage.module.css';

type EventTab = 'participating' | 'created';
type ListModal = 'subscriptions' | 'subscribers' | null;

// Цвет плашки возрастного ограничения
function ageBadgeClass(age: number): string {
  if (age >= 18) return styles.ageBadgeRed;
  if (age >= 12) return styles.ageBadgeAmber;
  return styles.ageBadgeGreen;
}

// Цвет маркера категории
const CAT_COLORS: Record<string, string> = {
  music: '#8b5cf6', sport: '#10b981', art: '#f59e0b', food: '#f97316',
};
const getCatColor = (p?: string | null) => {
  for (const [k, c] of Object.entries(CAT_COLORS)) if (p?.startsWith(k)) return c;
  return '#6366f1';
};

// ---- Мини-карточка мероприятия ----
function EventMiniCard({ event, onClick }: { event: IEvent; onClick: () => void }) {
  const cost = event.parameters?.cost ?? 0;
  const age  = event.parameters?.ageLimit;
  const color = getCatColor(event.eventType?.eventCategory?.namePath);
  const dateStr = event.startTime
    ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(event.startTime))
    : '';

  return (
    <div className={styles.eventMini} onClick={onClick}>
      <div className={styles.eventDot} style={{ background: color }} />
      <div className={styles.eventMiniInfo}>
        <div className={styles.eventMiniName}>{event.name}</div>
        <div className={styles.eventMiniMeta}>
          {dateStr && <span className={styles.eventMiniDate}>{dateStr}{event.address ? ` · ${event.address}` : ''}</span>}
          {age != null && age > 0 && (
            <span className={`${styles.ageBadge} ${ageBadgeClass(age)}`}>{age}+</span>
          )}
        </div>
      </div>
      <span className={styles.eventMiniCost} style={{ color: cost === 0 ? '#10b981' : '#f59e0b' }}>
        {cost === 0 ? 'Бесплатно' : `${cost.toLocaleString('ru-RU')} ₽`}
      </span>
    </div>
  );
}

// ---- Список событий на вкладке ----
function UserEventList({ accountId, tab }: { accountId: string; tab: EventTab }) {
  const navigate = useNavigate();
  const params = tab === 'participating'
    ? { participantId: accountId }
    : { organizatorId: accountId };
  const { events, isLoading } = useEvents(params);

  if (isLoading) return (
    <div className={styles.eventSkeletons}>
      {[1, 2, 3].map(i => <div key={i} className={styles.eventSkeleton} />)}
    </div>
  );
  if (!events.length) return (
    <p className={styles.placeholder}>
      {tab === 'participating' ? 'Нет мероприятий' : 'Нет организованных мероприятий'}
    </p>
  );
  return (
    <>
      {events.map(ev => (
        <EventMiniCard key={ev.id} event={ev} onClick={() => navigate(`/event/${ev.id}`)} />
      ))}
    </>
  );
}

// ---- Рейтинг звёздами ----
function StarRating({ rating }: { rating: number }) {
  return (
    <div className={styles.stars}>
      {[1, 2, 3, 4, 5].map(i => {
        const fill = Math.min(1, Math.max(0, rating - (i - 1)));
        return (
          <svg key={i} className={styles.star} viewBox="0 0 24 24">
            <defs>
              <linearGradient id={`sg${i}`}>
                <stop offset={`${fill * 100}%`} stopColor="#f59e0b" />
                <stop offset={`${fill * 100}%`} stopColor="var(--color-border-secondary, #d1d5db)" />
              </linearGradient>
            </defs>
            <polygon
              points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
              fill={`url(#sg${i})`}
            />
          </svg>
        );
      })}
    </div>
  );
}

// ---- Основной компонент ----
export default function UserPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const myAccountId      = getStoredAccountId();
  const isOwnProfile     = !id || id === 'me' || id === myAccountId;
  const targetId         = isOwnProfile ? null : id;
  const profileAccountId = isOwnProfile ? (myAccountId ?? '') : (id ?? '');

  const [profile,     setProfile]     = useState<IFullProfile | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [activeTab,   setActiveTab]   = useState<EventTab>('participating');
  const [subsCount,   setSubsCount]   = useState(0);
  const [subscrCount, setSubscrCount] = useState(0);
  const [listModal,   setListModal]   = useState<ListModal>(null);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [isSubscribed,  setIsSubscribed]  = useState(false);
  const [lightboxFileIds, setLightboxFileIds] = useState<string[] | null>(null);

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
    ]).then(([s, sc]) => { setSubsCount(s); setSubscrCount(sc); });
  }, [profileAccountId]);

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

  if (loading) return <Skeleton />;
  if (error || !profile) return (
    <div className={styles.errorState}>
      <span>😕</span>
      <p>{error ?? 'Пользователь не найден'}</p>
      <button onClick={() => navigate(-1)}>← Назад</button>
    </div>
  );

  const { account, contacts, contactsError, person } = profile;
  const fullName = [person?.lastName, person?.firstName].filter(Boolean).join(' ');
  const age = person?.birthDate
    ? Math.floor((Date.now() - new Date(person.birthDate).getTime()) / 31_557_600_000)
    : null;
  const visibleContacts = contacts.filter(c => isOwnProfile || c.show);
  const initials = (fullName || account.login).slice(0, 2).toUpperCase();
  // TODO: rating из API когда появится эндпоинт
  const rating: number | null = null;

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* ── Баннер ── */}
        <div className={styles.banner}>
          <button className={styles.bannerBack} onClick={() => navigate(-1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          {!isOwnProfile && (
            <div className={styles.bannerActions}>
              {isSubscribed ? (
                <button className={`${styles.bannerBtn} ${styles.bannerBtnSub}`} onClick={handleUnsubscribe}>
                  Отписаться
                </button>
              ) : (
                <button className={styles.bannerBtn} onClick={() => setShowSubscribe(true)}>
                  Подписаться
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Шапка профиля ── */}
        <div className={styles.profileHeader}>
          <div
            className={styles.avatarWrap}
            style={{ cursor: 'pointer' }}
            onClick={async () => {
              const history = await getAvatarHistory(profileAccountId);
              setLightboxFileIds(history.map(h => typeof h === 'string' ? h : (h as any).fileId ?? (h as any).id).filter(Boolean));
            }}
            title="Нажмите для просмотра"
          >
            <UserAvatar
              accountId={profileAccountId}
              initials={initials}
              size={80}
              className={styles.avatar}
            />
          </div>

          <div className={styles.nameRow}>
            <div>
              {fullName && <div className={styles.fullName}>{fullName}</div>}
              <div className={styles.loginLine}>@{account.login}</div>
            </div>
            {isOwnProfile && (
              <button className={styles.editBtn} onClick={() => navigate('/settings')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Редактировать
              </button>
            )}
          </div>

          {/* Счётчики + рейтинг */}
          <div className={styles.statsRow}>
            <button className={styles.statBtn} onClick={() => setListModal('subscriptions')}>
              <span className={styles.statNum}>{subsCount}</span>
              <span className={styles.statLabel}>подписки</span>
            </button>
            <div className={styles.statDivider} />
            <button className={styles.statBtn} onClick={() => setListModal('subscribers')}>
              <span className={styles.statNum}>{subscrCount}</span>
              <span className={styles.statLabel}>подписчики</span>
            </button>

            {rating !== null && (
              <>
                <div className={styles.statDivider} />
                <div className={styles.ratingBadge}>
                  <StarRating rating={rating} />
                  <span className={styles.ratingNum}>{rating.toFixed(1)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Мета-чипы ── */}
        {(age !== null || person?.gender) && (
          <div className={styles.metaRow}>
            {age !== null && (
              <div className={styles.metaChip}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                {age} лет
              </div>
            )}
            {person?.gender && (
              <div className={styles.metaChip}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {person.gender === 'Male' ? 'Мужской' : 'Женский'}
              </div>
            )}
          </div>
        )}

        {/* ── Двухколонная часть ── */}
        <div className={styles.twoCol}>

          {/* Левая: контакты + мероприятия */}
          <div className={styles.leftCol}>

            {/* Контакты */}
            {visibleContacts.length > 0 && (
              <div className={styles.contactsSection}>
                <div className={styles.secLabel}>Контакты</div>
                <ContactsList contacts={visibleContacts} />
              </div>
            )}

            {/* Мероприятия */}
            <div className={styles.eventsSection}>
              <div className={styles.secLabel}>Мероприятия</div>
              <div className={styles.tabsRow}>
                <button
                  className={`${styles.tab} ${activeTab === 'participating' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('participating')}
                >Участвует</button>
                <button
                  className={`${styles.tab} ${activeTab === 'created' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('created')}
                >Организует</button>
              </div>
              <UserEventList accountId={profileAccountId} tab={activeTab} />
            </div>
          </div>

          {/* Правая: карточка с мета */}
          <div className={styles.rightCol}>
            <div className={styles.secLabel}>Подробнее</div>
            <div className={styles.infoCard}>
              {account.id && (
                <InfoRow icon={<IdIcon />} label="ID аккаунта" value={account.id.slice(0, 8) + '...'} />
              )}
              {person?.birthDate && (
                <InfoRow icon={<CalIcon />} label="Дата рождения"
                  value={new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(person.birthDate))} />
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Модалы */}
      {showSubscribe && (
        <SubscribeModal targetLogin={account.login} onConfirm={handleSubscribe} onCancel={() => setShowSubscribe(false)} />
      )}
      {listModal === 'subscriptions' && (
        <SubscribersListModal title="Подписки" fetchFn={() => fetchSubscriptions(profileAccountId)}
          currentAccountId={myAccountId} onClose={() => setListModal(null)} />
      )}
      {listModal === 'subscribers' && (
        <SubscribersListModal title="Подписчики" fetchFn={() => fetchSubscribers(profileAccountId)}
          currentAccountId={myAccountId} onClose={() => setListModal(null)} />
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

// ---- Вспомогательные компоненты ----

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className={styles.infoRow}>
      <div className={styles.infoIcon}>{icon}</div>
      <div>
        <div className={styles.infoKey}>{label}</div>
        <div className={styles.infoVal}>{value}</div>
      </div>
    </div>
  );
}

function ContactsList({ contacts }: { contacts: IContactDataItem[] }) {
  const groups = contacts.reduce<Record<string, { label: string; items: IContactDataItem[] }>>(
    (acc, c) => {
      const key   = c.contactType?.id ?? 'other';
      const label = (c.contactType as any)?.name ?? c.contactType?.localizedName ?? 'Контакт';
      if (!acc[key]) acc[key] = { label, items: [] };
      acc[key].items.push(c);
      return acc;
    }, {}
  );
  return (
    <div className={styles.contactsList}>
      {Object.values(groups).map(({ label, items }) => (
        <div key={label} className={styles.contactGroup}>
          <span className={styles.contactTypeName}>{label}</span>
          <div className={styles.contactVals}>
            {items.map(c => <span key={c.id} className={styles.contactVal}>{c.value}</span>)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.banner} />
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--surface)', marginTop: -40 }} />
          <div style={{ height: 20, width: '40%', borderRadius: 8, background: 'var(--surface)' }} />
          <div style={{ height: 14, width: '25%', borderRadius: 8, background: 'var(--surface)' }} />
        </div>
      </div>
    </div>
  );
}

function IdIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/></svg>; }
function CalIcon(){ return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
