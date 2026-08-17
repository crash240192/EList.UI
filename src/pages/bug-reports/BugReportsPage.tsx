// pages/bug-reports/BugReportsPage.tsx

import { PlatformStaffGate } from '@/features/admin/PlatformStaffGate';
import { BugReportsTab } from '@/pages/admin/BugReportsTab';
import { usePageTitle } from '@/shared/hooks';
import styles from './BugReportsPage.module.css';

export default function BugReportsPage() {
  usePageTitle('Багрепорты');

  return (
    <PlatformStaffGate title="Проверка доступа…">
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Багрепорты</h1>
          <p className={styles.subtitle}>Обращения пользователей об ошибках</p>
        </div>
        <div className={styles.content}>
          <BugReportsTab />
        </div>
      </div>
    </PlatformStaffGate>
  );
}
