// shared/ui/AvatarLightbox/AvatarLightbox.tsx

import { deleteAvatar } from '@/entities/user/avatarApi';
import { ImageLightbox } from '@/shared/ui/ImageLightbox';
import imageStyles from '@/shared/ui/ImageLightbox/ImageLightbox.module.css';

interface AvatarLightboxProps {
  fileIds: string[];
  startIndex?: number;
  initials: string;
  onClose: () => void;
  canDelete?: boolean;
  onDeleted?: (fileId: string) => void | Promise<void>;
}

export function AvatarLightbox({
  fileIds,
  startIndex = 0,
  initials,
  onClose,
  canDelete = false,
  onDeleted,
}: AvatarLightboxProps) {
  return (
    <ImageLightbox
      fileIds={fileIds}
      startIndex={startIndex}
      alt={initials}
      onClose={onClose}
      canDelete={canDelete}
      onDelete={canDelete ? deleteAvatar : undefined}
      deleteMessage="Аватар будет удалён из истории профиля."
      onDeleted={onDeleted}
      fallback={
        <div className={imageStyles.fallback}>
          <span className={imageStyles.fallbackText}>{initials}</span>
        </div>
      }
    />
  );
}
