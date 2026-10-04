// features/organizations/OrgLogoUpload.tsx
// Логотип организации: кадр в квадратном окне, затем прежний контракт API —
// POST /api/upload и GET /api/media/organization/avatars/setNew.

import { useEffect, useRef, useState } from 'react';
import { uploadFile } from '@/shared/api/fileStorageClient';
import { setOrganizationAvatar } from '@/entities/organization';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { AvatarCropDialog } from '@/shared/ui/AvatarUpload/AvatarCropDialog';
import styles from './OrganizationsSettingsPanel.module.css';

interface OrgLogoUploadProps {
  organizationId: string;
  fileId?: string | null;
  initials: string;
  onChanged?: (fileId: string) => void;
}

export function OrgLogoUpload({
  organizationId,
  fileId: initialFileId,
  initials,
  onChanged,
}: OrgLogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileId, setFileId] = useState<string | null>(initialFileId ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropName, setCropName] = useState('logo');
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
      await setOrganizationAvatar(organizationId, uploaded.id);
      setFileId(uploaded.id);
      onChanged?.(uploaded.id);
      closeCrop();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить логотип');
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
    setCropName(file.name || 'logo');
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
    const url = URL.createObjectURL(file);
    cropSrcRef.current = url;
    setCropSrc(url);
  };

  return (
    <div className={styles.logoUpload}>
      <button
        type="button"
        className={styles.logoBtn}
        onClick={() => !loading && !cropSrc && inputRef.current?.click()}
        disabled={loading}
        aria-label="Загрузить логотип"
      >
        {displayFileId ? (
          <AuthImage
            fileId={displayFileId}
            alt=""
            className={styles.logoImg}
            fallback={<span className={styles.logoInitials}>{initials.slice(0, 2).toUpperCase()}</span>}
          />
        ) : (
          <span className={styles.logoInitials}>{initials.slice(0, 2).toUpperCase()}</span>
        )}
        {loading && <span className={styles.logoSpinner} />}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={e => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) openCrop(file);
        }}
      />
      {error && <p className={styles.inlineErr}>{error}</p>}
      {cropSrc && (
        <AvatarCropDialog
          src={cropSrc}
          fileName={cropName}
          saving={loading}
          shape="rounded-square"
          title="Кадр логотипа"
          lead="Перетащите фото и подгоните масштаб. В квадрат попадёт то, что видно в окне."
          onCancel={closeCrop}
          onConfirm={file => { void uploadCropped(file); }}
        />
      )}
    </div>
  );
}
