// shared/ui/AvatarUpload/AvatarUpload.tsx
// Загрузка аватара: тап открывает «Кадр аватара», а не сразу выбор файла.

import { useEffect, useState } from 'react';
import { useAvatarCropDisplay } from '@/entities/user/avatarApi';
import { seedAvatarCache } from '@/features/auth/useAvatar';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { AvatarFrameSession } from './AvatarFrameSession';
import styles from './AvatarUpload.module.css';

interface AvatarUploadProps {
  initials:   string;
  accountId:  string;
  fileId?:    string | null;
  size?:      number;
  onChanged?: (fileId: string | null) => void;
}

export function AvatarUpload({ initials, accountId, fileId: initialFileId, size = 80, onChanged }: AvatarUploadProps) {
  const [fileId, setFileId] = useState<string | null>(initialFileId ?? null);
  const [frameOpen, setFrameOpen] = useState(false);
  const { displayFileId, imgStyle } = useAvatarCropDisplay(fileId ?? initialFileId ?? null);

  useEffect(() => {
    setFileId(initialFileId ?? null);
  }, [initialFileId]);

  return (
    <div className={styles.wrap} style={{ width: size, height: size }}>
      <div
        className={styles.avatar}
        style={{ width: size, height: size, fontSize: size * 0.34 }}
        onClick={() => setFrameOpen(true)}
        title="Нажмите, чтобы выбрать кадр"
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setFrameOpen(true);
          }
        }}
      >
        {displayFileId
          ? <AuthImage
              fileId={displayFileId}
              alt="Аватар"
              className={styles.img}
              style={imgStyle}
              fallback={<span>{initials}</span>}
            />
          : <span>{initials}</span>}
        <div className={styles.overlay}>
          <span className={styles.overlayText}>Фото</span>
        </div>
      </div>
      <AvatarFrameSession
        open={frameOpen}
        accountId={accountId}
        fileId={fileId ?? initialFileId ?? null}
        onClose={() => setFrameOpen(false)}
        onChanged={next => {
          setFileId(next);
          seedAvatarCache(accountId, next);
          onChanged?.(next);
        }}
      />
    </div>
  );
}
