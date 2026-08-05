// features/organization/OrganizationShareMenu.tsx

import { useMemo } from 'react';
import { useToastStore } from '@/app/store';
import { buildOrganizationProfileUrl, copyText } from '@/shared/lib/shareLink';
import { ShareMenu } from '@/shared/ui/ShareMenu/ShareMenu';

interface Props {
  organizationId: string;
  name: string;
  onClose: () => void;
}

export function OrganizationShareMenu({ organizationId, name, onClose }: Props) {
  const profileUrl = useMemo(
    () => buildOrganizationProfileUrl(organizationId),
    [organizationId],
  );

  const handleCopyCode = () => {
    void copyText(organizationId)
      .then(() => {
        useToastStore.getState().add('Код скопирован', 'success');
        onClose();
      })
      .catch(() => useToastStore.getState().add('Не удалось скопировать', 'error'));
  };

  return (
    <ShareMenu
      subtitle={`Выберите способ передачи страницы «${name}»`}
      url={profileUrl}
      shareTitle={name}
      shareText={`Организация «${name}»`}
      qrTitle="QR-код организации"
      qrSubtitle={`Отсканируйте камерой, чтобы открыть «${name}»`}
      onClose={onClose}
      prependOptions={[
        { label: 'Скопировать код', onClick: handleCopyCode },
      ]}
    />
  );
}
