// shared/ui/AvatarUpload/AvatarUpload.tsx
// Загрузка аватара: сначала кадр в круглом окне, затем тот же контракт API —
// POST /api/upload и GET /api/media/account/avatars/setNew/{photoId}.

import { useEffect, useRef, useState } from 'react';
import { uploadFile } from '@/shared/api/fileStorageClient';
import { setAvatar } from '@/entities/user/avatarApi';
import { seedAvatarCache } from '@/features/auth/useAvatar';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { AvatarCropDialog } from './AvatarCropDialog';
import styles from './AvatarUpload.module.css';

interface AvatarUploadProps {
  initials:   string;
  accountId:  string;
  fileId?:    string | null;
  size?:      number;
  onChanged?: (fileId: string) => void;
}

export function AvatarUpload({ initials, accountId, fileId: initialFileId, size = 80, onChanged }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileId, setFileId] = useState<string | null>(initialFileId ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropName, setCropName] = useState('avatar');
  const cropSrcRef = useRef<string | null>(null);

  useEffect(() => {
    setFileId(initialFileId ?? null);
  }, [initialFileId]);

  useEffect(() => () => {
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
  }, []);

  const displayFileId = fileId ?? initialFileId ?? null;

  const closeCrop = () => {
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
    cropSrcRef.current = null;
    setCropSrc(null);
  };

  const uploadCropped = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const uploaded = await uploadFile(file);
      await setAvatar(uploaded.id);
      seedAvatarCache(accountId, uploaded.id);
      setFileId(uploaded.id);
      onChanged?.(uploaded.id);
      closeCrop();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      closeCrop();
    } finally {
      setLoading(false);
    }
  };

  const openCrop = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Выберите изображение');
      return;
    }
    setError(null);
    setCropName(file.name || 'avatar');
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
    const url = URL.createObjectURL(file);
    cropSrcRef.current = url;
    setCropSrc(url);
  };

  return (
    <div className={styles.wrap} style={{ width: size, height: size }}>
      <div
        className={styles.avatar}
        style={{ width: size, height: size, fontSize: size * 0.34 }}
        onClick={() => !loading && !cropSrc && inputRef.current?.click()}
        title="Нажмите чтобы сменить фото"
      >
        {displayFileId
          ? <AuthImage fileId={displayFileId} alt="Аватар" className={styles.img}
              fallback={<span>{initials}</span>} />
          : <span>{initials}</span>}
        <div className={styles.overlay}>
          {loading ? <span className={styles.spinner} /> : <span className={styles.overlayText}>Фото</span>}
        </div>
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={e => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) openCrop(file);
        }}
      />
      {cropSrc && (
        <AvatarCropDialog
          src={cropSrc}
          fileName={cropName}
          saving={loading}
          onCancel={closeCrop}
          onConfirm={file => { void uploadCropped(file); }}
        />
      )}
    </div>
  );
}
