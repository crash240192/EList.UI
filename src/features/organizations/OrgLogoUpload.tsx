// features/organizations/OrgLogoUpload.tsx
// Логотип организации: кадр как у аватара — новый файл только при выборе фото.

import { useEffect, useState } from 'react';
import { setOrganizationAvatar } from '@/entities/organization';
import { useAvatarCropDisplay } from '@/entities/user/avatarApi';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { PhotoFrameSession } from '@/shared/ui/AvatarUpload/PhotoFrameSession';
import styles from './OrganizationsSettingsPanel.module.css';

interface OrgLogoUploadProps {
  organizationId: string;
  fileId?: string | null;
  initials: string;
  onChanged?: (fileId: string | null) => void;
}

export function OrgLogoUpload({
  organizationId,
  fileId: initialFileId,
  initials,
  onChanged,
}: OrgLogoUploadProps) {
  const [fileId, setFileId] = useState<string | null>(initialFileId ?? null);
  const [frameOpen, setFrameOpen] = useState(false);
  const { displayFileId, imgStyle } = useAvatarCropDisplay(fileId ?? initialFileId ?? null);

  useEffect(() => {
    setFileId(initialFileId ?? null);
  }, [initialFileId]);

  return (
    <div className={styles.logoUpload}>
      <button
        type="button"
        className={styles.logoBtn}
        onClick={() => setFrameOpen(true)}
        aria-label="Изменить логотип"
        title="Нажмите, чтобы выбрать кадр"
      >
        {displayFileId ? (
          <AuthImage
            fileId={displayFileId}
            alt=""
            className={styles.logoImg}
            style={imgStyle}
            fallback={<span className={styles.logoInitials}>{initials.slice(0, 2).toUpperCase()}</span>}
          />
        ) : (
          <span className={styles.logoInitials}>{initials.slice(0, 2).toUpperCase()}</span>
        )}
      </button>
      <PhotoFrameSession
        open={frameOpen}
        fileId={fileId ?? initialFileId ?? null}
        onClose={() => setFrameOpen(false)}
        onChanged={next => {
          setFileId(next);
          onChanged?.(next);
        }}
        assignFile={async nextId => {
          await setOrganizationAvatar(organizationId, nextId);
        }}
        shape="rounded-square"
        title="Кадр логотипа"
        lead="Перетащите фото и подгоните масштаб. В квадрат попадёт то, что видно в окне."
        emptyFileName="logo"
      />
    </div>
  );
}
