// Выбор менеджеров организации из подписчиков текущего пользователя

import { SubscribersMultiSelectModal } from '@/features/subscriptions/SubscribersMultiSelectModal';

interface Props {
  currentAccountId: string;
  existingMemberIds: ReadonlySet<string>;
  onClose: () => void;
  onConfirm: (accountIds: string[]) => void;
}

export function AddOrgManagersFromSubscribersModal({
  currentAccountId,
  existingMemberIds,
  onClose,
  onConfirm,
}: Props) {
  return (
    <SubscribersMultiSelectModal
      currentAccountId={currentAccountId}
      existingIds={existingMemberIds}
      existingBadge="В команде"
      title="Добавить из подписок"
      confirmLabel="Добавить"
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
