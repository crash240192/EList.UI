// entities/user/ui/UserAvatar/UserAvatar.tsx
// Аватар пользователя — fileId из avatarId аккаунта, без отдельного запроса

import { useAvatar } from '@/features/auth/useAvatar';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import styles from './UserAvatar.module.css';

interface UserAvatarProps {
  accountId: string;
  initials:  string;
  avatarId?: string | null;
  size?:     number;
  className?: string;
}

export function UserAvatar({ accountId, initials, avatarId, size = 32, className }: UserAvatarProps) {
  const fileId = useAvatar(accountId, avatarId);

  const style = {
    width:    size,
    height:   size,
    fontSize: size * 0.38,
    borderRadius: '50%',
  };

  return (
    <div className={`${styles.avatar} ${className ?? ''}`} style={style}>
      {fileId
        ? <AuthImage fileId={fileId} alt={initials} className={styles.img}
            fallback={<span>{initials}</span>} />
        : <span>{initials}</span>}
    </div>
  );
}
