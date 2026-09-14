// Добавление организаторов события из подписчиков текущего пользователя

import { assignEventOrganizators } from '@/entities/event';
import { SubscribersMultiSelectModal } from '@/features/subscriptions/SubscribersMultiSelectModal';

interface Props {
  eventId: string;
  currentAccountId: string;
  existingOrganizerIds: Set<string>;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddOrganizerModal({
  eventId,
  currentAccountId,
  existingOrganizerIds,
  onClose,
  onSuccess,
}: Props) {
  return (
    <SubscribersMultiSelectModal
      currentAccountId={currentAccountId}
      existingIds={existingOrganizerIds}
      existingBadge="Организатор"
      title="Добавить организатора"
      confirmLabel="Добавить"
      successMessage="Организаторы добавлены!"
      onClose={onClose}
      onSubmit={async accountIds => {
        await assignEventOrganizators({
          eventId,
          accountIds,
          organizationIds: [],
        });
        onSuccess();
      }}
    />
  );
}
