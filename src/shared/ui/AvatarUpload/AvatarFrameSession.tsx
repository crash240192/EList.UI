// Окно «Кадр аватара» профиля — обёртка над PhotoFrameSession.

import { deleteAvatar, setAvatar } from '@/entities/user/avatarApi';
import { seedAvatarCache } from '@/features/auth/useAvatar';
import { PhotoFrameSession } from './PhotoFrameSession';

interface AvatarFrameSessionProps {
  open: boolean;
  accountId: string;
  fileId: string | null;
  onClose: () => void;
  onChanged: (fileId: string | null) => void;
}

export function AvatarFrameSession({
  open,
  accountId,
  fileId,
  onClose,
  onChanged,
}: AvatarFrameSessionProps) {
  return (
    <PhotoFrameSession
      open={open}
      fileId={fileId}
      onClose={onClose}
      onChanged={next => {
        seedAvatarCache(accountId, next);
        onChanged(next);
      }}
      assignFile={async nextId => {
        await setAvatar(nextId);
        seedAvatarCache(accountId, nextId);
      }}
      deleteFile={async id => {
        await deleteAvatar(id);
        seedAvatarCache(accountId, null);
      }}
    />
  );
}
