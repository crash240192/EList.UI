// pages/moderation/PlatformModerationPage.tsx

import { PlatformStaffGate } from '@/features/admin/PlatformStaffGate';
import { usePlatformModerationCountStore } from '@/features/admin/usePlatformModerationCount';
import { PlatformModerationTab } from '@/pages/admin/PlatformModerationTab';
import { usePageTitle } from '@/shared/hooks';
import styles from './PlatformModerationPage.module.css';

export default function PlatformModerationPage() {
  usePageTitle('Модерация');
  const setModerationCount = usePlatformModerationCountStore(s => s.setCount);

  return (
    <PlatformStaffGate title="Проверка доступа к модерации…">
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Модерация</h1>
          <p className={styles.subtitle}>Очередь жалоб площадки</p>
        </div>
        <div className={styles.content}>
          <PlatformModerationTab onActiveCountChange={setModerationCount} />
        </div>
      </div>
    </PlatformStaffGate>
  );
}
