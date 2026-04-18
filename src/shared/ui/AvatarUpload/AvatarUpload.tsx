// shared/ui/AvatarUpload/AvatarUpload.tsx

import { useRef, useState } from 'react';
import { uploadFile } from '@/shared/api/fileStorageClient';
import { setAvatar } from '@/entities/user/avatarApi';
import { invalidateAvatarCache } from '@/features/auth/useAvatar';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import styles from './AvatarUpload.module.css';

interface AvatarUploadProps {
  initials:   string;
  accountId:  string;
  fileId?:    string | null;  // текущий fileId из useAvatar
  size?:      number;
  onChanged?: (fileId: string) => void;
}

export function AvatarUpload({ initials, accountId, fileId: initialFileId, size = 80, onChanged }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileId,  setFileId]  = useState<string | null>(initialFileId ?? null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setLoading(true); setError(null);
    try {
      // 1. Загружаем файл в хранилище
      const uploaded = await uploadFile(file);
      // 2. Назначаем новый аватар через основной API
      await setAvatar(uploaded.id);
      // 3. Инвалидируем кэш и обновляем локальный state
      invalidateAvatarCache(accountId);
      setFileId(uploaded.id);
      onChanged?.(uploaded.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.wrap} style={{ width: size, height: size }}>
      <div
        className={styles.avatar}
        style={{ width: size, height: size, fontSize: size * 0.34 }}
        onClick={() => !loading && inputRef.current?.click()}
        title="Нажмите чтобы сменить фото"
      >
        {fileId
          ? <AuthImage fileId={fileId} alt="Аватар" className={styles.img}
              fallback={<span>{initials}</span>} />
          : <span>{initials}</span>}
        <div className={styles.overlay}>
          {loading ? <span className={styles.spinner} /> : '📷'}
        </div>
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <input ref={inputRef} type="file" accept="image/*" className={styles.hiddenInput}
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
    </div>
  );
}
