// pages/user/UserPage.tsx

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/app/store';
import { getStoredAccountId } from '@/entities/user/api';
import { fetchFullProfile } from '@/entities/user/profileApi';
import type { IFullProfile, IContactDataItem } from '@/entities/user/profileApi';
import { EventCard } from '@/entities/event';
import { useEvents } from '@/features/event-list/useEvents';
import { useFavoritesStore } from '@/app/store';
import {
  fetchSubscriptionsCount, fetchSubscribersCount,
  fetchSubscriptions, fetchSubscribers,
  subscribe, unsubscribe,
  type INotifySettings, type ISubscriptionItem,
} from '@/entities/user/subscriptionApi';
import { SubscribeModal } from '@/features/subscriptions/SubscribeModal';
import { SubscribersListModal } from '@/features/subscriptions/SubscribersListModal';
import styles from './UserPage.module.css';

type EventTab = 'participating' | 'created';
type ListModal = 'subscriptions' | 'subscribers' | null;

// ---- Вложенный компонент: список событий ----
function UserEventList({ accountId, tab }: { accountId: string; tab: EventTab }) {
  const navigate = useNavigate();
  const { toggle: toggleFav, isFavorite } = useFavoritesStore();
  const params = tab === 'participating'
    ? { participantId: accountId }
    : { organizatorId: accountId };
  const { events, isLoading } = useEvents(params);

  if (isLoading) return (
    <div className={styles.eventsGrid}>
      {[1,2,3].map(i => <div key={i} className={styles.eventSkeleton} />)}
    </div>
  );
  if (!events.length) return (
    <p className={styles.placeholder}>
      {tab === 'participating' ? 'Нет мероприятий' : 'Нет организованных мероприятий'}
    </p>
  );
  return (
    <div className={styles.eventsGrid}>
      {events.map(ev => (
        <EventCard.Preset key={ev.id} event={ev}
          onClick={() => navigate(`/event/${ev.id}`)}
          isFavorite={isFavorite(ev.id)} onFavorite={toggleFav} />
      ))}
    </div>
  );
}

// ---- Основной компонент ----
export default function UserPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const myAccountId  = getStoredAccountId();
  const isOwnProfile = !id || id === 'me' || id === myAccountId;
  const targetId     = isOwnProfile ? null : id;
  // Для запросов к API подписок нужен реальный ID (не 'me')
  const profileAccountId = isOwnProfile ? (myAccountId ?? '') : (id ?? '');

  const [profile,    setProfile]    = useState<IFullProfile | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [activeTab,  setActiveTab]  = useState<EventTab>('participating');

  // Счётчики подписок
  const [subsCount,  setSubsCount]  = useState<number>(0);
  const [subscrCount,setSubscrCount]= useState<number>(0);

  // Модалки
  const [listModal,      setListModal]      = useState<ListModal>(null);
  const [showSubscribe,  setShowSubscribe]  = useState(false);
  const [isSubscribed,   setIsSubscribed]  = useState(false);

  // Загрузка профиля
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchFullProfile(targetId)
      .then(setProfile)
      .catch(e => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [targetId]);

  // Загрузка счётчиков
  useEffect(() => {
    if (!profileAccountId) return;
    Promise.all([
      fetchSubscriptionsCount(profileAccountId),
      fetchSubscribersCount(profileAccountId),
    ]).then(([subs, subscr]) => {
      setSubsCount(subs);
      setSubscrCount(subscr);
    });
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
    <div className={styles.error}>
      <span>😕</span><p>{error ?? 'Пользователь не найден'}</p>
      <button onClick={() => navigate(-1)}>← Назад</button>
    </div>
  );

  const { account, contacts, contactsError, person } = profile;
  const fullName = [person?.lastName, person?.firstName, person?.patronymic].filter(Boolean).join(' ');
  const age = person?.birthDate
    ? Math.floor((Date.now() - new Date(person.birthDate).getTime()) / 31_557_600_000)
    : null;
  const visibleContacts = contacts.filter(c => isOwnProfile || c.show);

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>←</button>

      {/* Шапка */}
      <div className={styles.header}>
        <div className={styles.avatarWrap}>
          <div className={styles.avatarPlaceholder}>{account.login[0].toUpperCase()}</div>
        </div>
        <div className={styles.headerInfo}>
          <h1 className={styles.login}>@{account.login}</h1>
          {fullName && <p className={styles.fullName}>{fullName}</p>}

          {/* Счётчики — кликабельные */}
          <div className={styles.stats}>
            <button className={styles.statItem} onClick={() => setListModal('subscriptions')}>
              <span className={styles.statNum}>{subsCount}</span>
              <span className={styles.statLabel}>подписок</span>
            </button>
            <button className={styles.statItem} onClick={() => setListModal('subscribers')}>
              <span className={styles.statNum}>{subscrCount}</span>
              <span className={styles.statLabel}>подписчиков</span>
            </button>
          </div>
        </div>
      </div>

      {/* Кнопки (чужой профиль) */}
      {!isOwnProfile && (
        <div className={styles.actions}>
          {isSubscribed ? (
            <button className={`${styles.subscribeBtn} ${styles.subscribedBtn}`}
              onClick={handleUnsubscribe}>
              Отписаться
            </button>
          ) : (
            <button className={styles.subscribeBtn} onClick={() => setShowSubscribe(true)}>
              Подписаться
            </button>
          )}
          <button className={styles.reportBtn} title="Пожаловаться">⚑</button>
        </div>
      )}

      {/* Инфо */}
      <div className={styles.infoGrid}>
        {age !== null && <InfoChip icon="🎂" label="Возраст" value={`${age} лет`} />}
        {person?.gender && (
          <InfoChip icon="👤" label="Пол" value={person.gender === 'Male' ? 'Мужской' : 'Женский'} />
        )}
      </div>

      {/* Контакты */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Контакты</h3>
        {contactsError ? (
          <p className={styles.contactsError}>{contactsError}</p>
        ) : visibleContacts.length > 0 ? (
          <ContactsList contacts={visibleContacts} />
        ) : (
          <p className={styles.placeholder}>Контакты не указаны</p>
        )}
      </div>

      {isOwnProfile && (
        <button className={styles.editBtn} onClick={() => navigate('/profile/edit')}>
          ✏️ Редактировать профиль
        </button>
      )}

      {/* Мероприятия */}
      <div className={styles.section}>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${activeTab === 'participating' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('participating')}>Участвует</button>
          <button className={`${styles.tab} ${activeTab === 'created' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('created')}>Организует</button>
        </div>
        <div className={styles.eventsList}>
          <UserEventList accountId={profileAccountId} tab={activeTab} />
        </div>
      </div>

      {/* Модал подписки */}
      {showSubscribe && (
        <SubscribeModal
          targetLogin={account.login}
          onConfirm={handleSubscribe}
          onCancel={() => setShowSubscribe(false)}
        />
      )}

      {/* Модал списка подписок/подписчиков */}
      {listModal === 'subscriptions' && (
        <SubscribersListModal
          title="Подписки"
          fetchFn={() => fetchSubscriptions(profileAccountId)}
          currentAccountId={myAccountId}
          onClose={() => setListModal(null)}
        />
      )}
      {listModal === 'subscribers' && (
        <SubscribersListModal
          title="Подписчики"
          fetchFn={() => fetchSubscribers(profileAccountId)}
          currentAccountId={myAccountId}
          onClose={() => setListModal(null)}
        />
      )}
    </div>
  );
}

// ---- Компоненты ----

function InfoChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className={styles.infoChip}>
      <span>{icon}</span>
      <div>
        <div className={styles.chipLabel}>{label}</div>
        <div className={styles.chipValue}>{value}</div>
      </div>
    </div>
  );
}

function ContactsList({ contacts }: { contacts: IContactDataItem[] }) {
  const groups = contacts.reduce<Record<string, { label: string; items: IContactDataItem[] }>>(
    (acc, c) => {
      const key   = c.contactType?.id ?? 'other';
      const label = (c.contactType as any)?.name
        ?? c.contactType?.localizedName
        ?? (c.contactType as any)?.namePath
        ?? 'Контакт';
      if (!acc[key]) acc[key] = { label, items: [] };
      acc[key].items.push(c);
      return acc;
    }, {}
  );
  return (
    <div className={styles.contactsGroups}>
      {Object.values(groups).map(({ label, items }) => (
        <div key={label} className={styles.contactGroup}>
          <span className={styles.contactGroupLabel}>{label}</span>
          <div className={styles.contactGroupValues}>
            {items.map(c => (
              <span key={c.id} className={styles.contactValue}>
                {c.value}
                {c.isAuthorizationContact && <span className={styles.authTag}>★</span>}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div className={styles.page}>
      <div className={styles.skeletonBlock} style={{ height: 90, borderRadius: 16 }} />
      <div className={styles.skeletonBlock} style={{ height: 20, width: '40%' }} />
    </div>
  );
}
