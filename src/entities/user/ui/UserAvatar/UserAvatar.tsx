// entities/user/ui/UserAvatar/UserAvatar.tsx
// Аватар пользователя — fileId из avatarId аккаунта, без отдельного запроса

import { useAvatar } from '@/features/auth/useAvatar';
import { useOnlinePresence } from '@/features/presence';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import styles from './UserAvatar.module.css';

interface UserAvatarProps {
  accountId: string;
  initials:  string;
  avatarId?: string | null;
  size?:     number;
  className?: string;
  style?:    React.CSSProperties;
  /** Показывать зелёную точку, если пользователь онлайн (по умолчанию да) */
  showOnline?: boolean;
  /** Явный статус; если не задан — берётся из presence store */
  online?: boolean | null;
}

export function UserAvatar({
  accountId,
  initials,
  avatarId,
  size = 32,
  className,
  style: styleProp,
  showOnline = true,
  online: onlineProp,
}: UserAvatarProps) {
  const fileId = useAvatar(accountId, avatarId);
  const presenceOnline = useOnlinePresence(showOnline && onlineProp == null ? accountId : null);
  const isOnline = onlineProp ?? presenceOnline;

  const style = {
    fontSize: size * 0.38,
    borderRadius: '50%',
    ...styleProp,
  };

  const dotSize = Math.max(8, Math.round(size * 0.28));

  return (
    <div className={`${styles.wrap} ${className ?? ''}`} style={{ width: size, height: size }}>
      <div className={styles.avatar} style={style}>
        {fileId
          ? <AuthImage fileId={fileId} alt={initials} className={styles.img}
              fallback={<span>{initials}</span>} />
          : <span>{initials}</span>}
      </div>
      {showOnline && isOnline && (
        <span
          className={styles.onlineDot}
          style={{ width: dotSize, height: dotSize }}
          title="Онлайн"
          aria-label="Онлайн"
        />
      )}
    </div>
  );
}
