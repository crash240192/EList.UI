// pages/user/UserPage.tsx

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/app/store';
import { getStoredAccountId } from '@/entities/user/api';
import { fetchFullProfile } from '@/entities/user/profileApi';
import type { IFullProfile, IContactDataItem } from '@/entities/user/profileApi';
import { EventCard } from '@/entities/event';
import { useEvents } from '@/features/event-list/useEvents';
import { useFavoritesStore } from '@/app/store';
import styles from './UserPage.module.css';

type EventTab = 'participating' | 'created';

// ---- Вложенный компонент: список событий пользователя ----
function UserEventList({
  accountId,
  tab,
}: {
  accountId: string;
  tab: EventTab;
}) {
  const navigate = useNavigate();
  const { toggle: toggleFav, isFavorite } = useFavoritesStore();

  const params = tab === 'participating'
    ? { participantId: accountId }
    : { organizatorId: accountId };

  const { events, isLoading } = useEvents(params);

  if (isLoading) {
    return (
      <div className={styles.eventsGrid}>
        {[1, 2, 3].map(i => <div key={i} className={styles.eventSkeleton} />)}
      </div>
    );
  }

  if (!events.length) {
    return (
      <p className={styles.placeholder}>
        {tab === 'participating' ? 'Нет мероприятий для участия' : 'Нет организованных мероприятий'}
      </p>
    );
  }

  return (
    <div className={styles.eventsGrid}>
      {events.map(ev => (
        <EventCard.Preset
          key={ev.id}
          event={ev}
          onClick={() => navigate(`/event/${ev.id}`)}
          isFavorite={isFavorite(ev.id)}
          onFavorite={toggleFav}
        />
      ))}
    </div>
  );
}

// ---- Основной компонент ----
export default function UserPage() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const myAccountId  = getStoredAccountId();
  const isOwnProfile = !id || id === 'me' || id === myAccountId;
  const targetId     = isOwnProfile ? null : id;

  const [profile,    setProfile]    = useState<IFullProfile | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [activeTab,  setActiveTab]  = useState<EventTab>('participating');
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchFullProfile(targetId)
      .then(setProfile)
      .catch(e => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [targetId]);

  if (loading) return <Skeleton />;
  if (error || !profile) return (
    <div className={styles.error}>
      <span>😕</span>
      <p>{error ?? 'Пользователь не найден'}</p>
      <button onClick={() => navigate(-1)}>← Назад</button>
    </div>
  );

  const { account, contacts, contactsError, person } = profile;

  const fullName = [person?.lastName, person?.firstName, person?.patronymic]
    .filter(Boolean).join(' ');

  const age = person?.birthDate
    ? Math.floor((Date.now() - new Date(person.birthDate).getTime()) / 31_557_600_000)
    : null;

  const visibleContacts = contacts.filter(c => isOwnProfile || c.show);

  // ID для запросов событий
  const profileAccountId = isOwnProfile ? (myAccountId ?? account.id) : account.id;

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>←</button>

      {/* ---- Шапка ---- */}
      <div className={styles.header}>
        <div className={styles.avatarWrap}>
          <div className={styles.avatarPlaceholder}>
            {account.login[0].toUpperCase()}
          </div>
        </div>
        <div className={styles.headerInfo}>
          <h1 className={styles.login}>@{account.login}</h1>
          {fullName && <p className={styles.fullName}>{fullName}</p>}
          <div className={styles.stats}>
            <div className={styles.statItem}>
              <span className={styles.statNum}>—</span>
              <span className={styles.statLabel}>подписчиков</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>—</span>
              <span className={styles.statLabel}>подписок</span>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Кнопки (чужой профиль) ---- */}
      {!isOwnProfile && (
        <div className={styles.actions}>
          <button
            className={`${styles.subscribeBtn} ${subscribed ? styles.subscribedBtn : ''}`}
            onClick={() => setSubscribed(v => !v)}
          >
            {subscribed ? 'Отписаться' : 'Подписаться'}
          </button>
          <button className={styles.reportBtn} title="Пожаловаться">⚑</button>
        </div>
      )}

      {/* ---- Инфо-чипы ---- */}
      <div className={styles.infoGrid}>
        {age !== null && <InfoChip icon="🎂" label="Возраст" value={`${age} лет`} />}
        {person?.gender && (
          <InfoChip icon="👤" label="Пол"
            value={person.gender === 'Male' ? 'Мужской' : 'Женский'} />
        )}
      </div>

      {/* ---- Контакты ---- */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Контакты</h3>
        {contactsError ? (
          <p className={styles.contactsError}>{contactsError}</p>
        ) : visibleContacts.length > 0 ? (
          <div className={styles.contactsList}>
            {visibleContacts.map(c => <ContactRow key={c.id} contact={c} />)}
          </div>
        ) : (
          <p className={styles.placeholder}>Контакты не указаны</p>
        )}
      </div>

      {/* ---- Редактирование ---- */}
      {isOwnProfile && (
        <button className={styles.editBtn} onClick={() => navigate('/profile/edit')}>
          ✏️ Редактировать профиль
        </button>
      )}

      {/* ---- Мероприятия ---- */}
      <div className={styles.section}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'participating' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('participating')}
          >
            Участвует
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'created' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('created')}
          >
            Организует
          </button>
        </div>
        <div className={styles.eventsList}>
          <UserEventList accountId={profileAccountId} tab={activeTab} />
        </div>
      </div>
    </div>
  );
}

// ---- Вспомогательные компоненты ----

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

function ContactRow({ contact }: { contact: IContactDataItem }) {
  const typeName = contact.contactType?.localizedName ?? contact.contactType?.namePath ?? 'Контакт';
  return (
    <div className={styles.contactRow}>
      <span className={styles.contactType}>{typeName}</span>
      <span className={styles.contactValue}>{contact.value}</span>
      {contact.isAuthorizationContact && (
        <span className={styles.authTag} title="Авторизационный контакт">★</span>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className={styles.page}>
      <div className={styles.skeletonBlock} style={{ height: 90, borderRadius: 16 }} />
      <div className={styles.skeletonBlock} style={{ height: 20, width: '40%' }} />
      <div className={styles.skeletonBlock} style={{ height: 20, width: '60%' }} />
    </div>
  );
}
