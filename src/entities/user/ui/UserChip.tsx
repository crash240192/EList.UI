// entities/user/ui/UserChip.tsx
// Мини-карточка пользователя: аватар + логин + рейтинг (опционально)

import { useNavigate } from 'react-router-dom';
import styles from './UserChip.module.css';

export interface IUserChipData {
  accountId: string;
  login: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  organizerRating?: number | null;
  visitorRating?: number | null;
  /** true если это текущий пользователь */
  isMe?: boolean;
}

interface UserChipProps {
  user: IUserChipData;
  /** Клик переходит на страницу профиля */
  clickable?: boolean;
  size?: 'sm' | 'md';
}

export function UserChip({ user, clickable = true, size = 'md' }: UserChipProps) {
  const navigate = useNavigate();

  // Безопасное получение инициалов — login или имя могут быть пустыми
  const safeLogin    = user.login?.trim() || '?';
  const safeFirst    = user.firstName?.trim() || '';
  const safeLast     = user.lastName?.trim()  || '';

  const initials = safeFirst && safeLast
    ? `${safeFirst[0]}${safeLast[0]}`.toUpperCase()
    : safeLogin[0].toUpperCase();

  const displayName = safeFirst
    ? `${safeFirst}${safeLast ? ' ' + safeLast : ''}`
    : safeLogin;

  const rating = user.organizerRating ?? user.visitorRating;

  const handleClick = () => {
    if (!clickable) return;
    navigate(user.isMe ? '/user/me' : `/user/${user.accountId}`);
  };

  return (
    <div
      className={`${styles.chip} ${styles[size]} ${clickable ? styles.clickable : ''} ${user.isMe ? styles.isMe : ''}`}
      onClick={handleClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
      aria-label={displayName}
    >
      {/* Avatar */}
      <div className={styles.avatar}>
        {user.avatarUrl
          ? <img src={user.avatarUrl} alt={user.login} className={styles.avatarImg} />
          : <span className={styles.avatarInitials}>{initials}</span>}
        {user.isMe && <span className={styles.meDot} title="Это вы" />}
      </div>

      {/* Info */}
      <div className={styles.info}>
        <span className={styles.login}>@{safeLogin}</span>
        {displayName !== safeLogin && (
          <span className={styles.name}>{displayName}</span>
        )}
      </div>

      {/* Rating */}
      {rating != null && (
        <span className={styles.rating}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
