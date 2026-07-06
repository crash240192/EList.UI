import { useMemo } from 'react';
import { useToastStore } from '@/app/store';
import { buildUserProfileUrl, copyText } from '@/shared/lib/shareLink';
import { ShareMenu } from '@/shared/ui/ShareMenu/ShareMenu';

interface Props {
  accountId: string;
  login: string;
  onClose: () => void;
}

export function UserShareMenu({ accountId, login, onClose }: Props) {
  const profileUrl = useMemo(() => buildUserProfileUrl(accountId), [accountId]);

  const handleCopyCode = () => {
    void copyText(accountId)
      .then(() => {
        useToastStore.getState().add('Код скопирован', 'success');
        onClose();
      })
      .catch(() => useToastStore.getState().add('Не удалось скопировать', 'error'));
  };

  return (
    <ShareMenu
      subtitle={`Выберите способ передачи профиля @${login}`}
      url={profileUrl}
      shareTitle={`Профиль @${login}`}
      shareText={`Профиль @${login}`}
      qrTitle="QR-код профиля"
      qrSubtitle={`Отсканируйте камерой, чтобы открыть профиль @${login}`}
      onClose={onClose}
      prependOptions={[
        { label: 'Скопировать код', onClick: handleCopyCode },
      ]}
    />
  );
}
