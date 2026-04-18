// entities/user/ui/UserAvatar/UserAvatar.tsx
// Аватар пользователя — загружает fileId через API и показывает через AuthImage

import { useAvatar } from '@/features/auth/useAvatar';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import styles from './UserAvatar.module.css';

interface UserAvatarProps {
  accountId: string;
  initials:  string;
  size?:     number;
  className?: string;
}

export function UserAvatar({ accountId, initials, size = 32, className }: UserAvatarProps) {
  const fileId = useAvatar(accountId);

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
