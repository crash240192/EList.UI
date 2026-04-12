// pages/user/UserPage.tsx

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/app/store';
import type { IAccount } from '@/entities/user/types';
import styles from './UserPage.module.css';

// Мок-данные пока нет API
const MOCK_USER: IAccount = {
  id: 'user-001',
  login: 'alex_city',
  avatarUrl: null,
  organizerRating: 4.6,
  visitorRating: 4.1,
  followersCount: 128,
  followingCount: 74,
  personInfo: {
    id: 'pi-001',
    accountId: 'user-001',
    firstName: 'Александр',
    lastName: 'Петров',
    patronymic: null,
    gender: 'Male',
    birthDate: '1992-05-14T00:00:00',
  },
};

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accountId } = useAuthStore();

  const [user, setUser] = useState<IAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'participating' | 'created'>('participating');
  const [subscribed, setSubscribed] = useState(false);

  const isOwnProfile = !id || id === 'me' || id === accountId;

  useEffect(() => {
    setLoading(true);
    // TODO: заменить на apiClient.get(`/api/accounts/getData/${id}`)
    setTimeout(() => {
      setUser(MOCK_USER);
      setLoading(false);
    }, 300);
  }, [id]);

  if (loading) return <Skeleton />;
  if (!user) return (
    <div className={styles.error}>
      <span>😕</span><p>Пользователь не найден</p>
      <button onClick={() => navigate(-1)}>← Назад</button>
    </div>
  );

  const fullName = [user.personInfo?.lastName, user.personInfo?.firstName, user.personInfo?.patronymic]
    .filter(Boolean).join(' ');

  const age = user.personInfo?.birthDate
    ? Math.floor((Date.now() - new Date(user.personInfo.birthDate).getTime()) / 31557600000)
    : null;

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>←</button>

      {/* ---- Header ---- */}
      <div className={styles.header}>
        <div className={styles.avatarWrap}>
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt={user.login} className={styles.avatar} />
            : <div className={styles.avatarPlaceholder}>{user.login[0].toUpperCase()}</div>}
        </div>

        <div className={styles.headerInfo}>
          <h1 className={styles.login}>@{user.login}</h1>
          {fullName && <p className={styles.fullName}>{fullName}</p>}

          <div className={styles.stats}>
            <button className={styles.statItem}>
              <span className={styles.statNum}>{user.followersCount ?? 0}</span>
              <span className={styles.statLabel}>подписчиков</span>
            </button>
            <button className={styles.statItem}>
              <span className={styles.statNum}>{user.followingCount ?? 0}</span>
              <span className={styles.statLabel}>подписок</span>
            </button>
          </div>
        </div>
      </div>

      {/* ---- Actions ---- */}
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

      {/* ---- Info cards ---- */}
      <div className={styles.infoGrid}>
        {age !== null && (
          <InfoChip icon="🎂" label="Возраст" value={`${age} лет`} />
        )}
        {user.personInfo?.gender && (
          <InfoChip icon="👤" label="Пол" value={user.personInfo.gender === 'Male' ? 'Мужской' : 'Женский'} />
        )}
        {user.organizerRating != null && (
          <InfoChip icon="⭐" label="Рейтинг организатора" value={user.organizerRating.toFixed(1)} />
        )}
        {user.visitorRating != null && (
          <InfoChip icon="🏅" label="Рейтинг посетителя" value={user.visitorRating.toFixed(1)} />
        )}
      </div>

      {/* ---- Events tabs ---- */}
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
          <p className={styles.placeholder}>
            {activeTab === 'participating'
              ? '📅 Мероприятия, в которых участвует пользователь'
              : '🎯 Мероприятия, созданные пользователем'}
            <br /><small>Интеграция: GET /api/events/search с participantId / organizatorId</small>
          </p>
        </div>
      </div>
    </div>
  );
}

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

function Skeleton() {
  return (
    <div className={styles.page} style={{ gap: 12 }}>
      <div className={styles.skeletonBlock} style={{ height: 100, borderRadius: 16 }} />
      <div className={styles.skeletonBlock} style={{ height: 20, width: '40%' }} />
      <div className={styles.skeletonBlock} style={{ height: 20, width: '60%' }} />
    </div>
  );
}
