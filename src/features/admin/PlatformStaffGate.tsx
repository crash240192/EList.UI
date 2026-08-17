// features/admin/PlatformStaffGate.tsx

import { useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePlatformRoleStore } from '@/app/store';
import styles from './PlatformStaffGate.module.css';

interface PlatformStaffGateProps {
  children: ReactNode;
  title?: string;
}

export function PlatformStaffGate({ children, title = 'Проверка доступа…' }: PlatformStaffGateProps) {
  const platformLoaded = usePlatformRoleStore(s => s.loaded);
  const platformLoading = usePlatformRoleStore(s => s.loading);
  const platformRole = usePlatformRoleStore(s => s.role);
  const platformActive = usePlatformRoleStore(s => s.active);
  const refreshPlatformRole = usePlatformRoleStore(s => s.refresh);
  const hasPlatformAccess = platformActive && platformRole != null;

  useEffect(() => {
    if (!platformLoaded && !platformLoading) {
      void refreshPlatformRole();
    }
  }, [platformLoaded, platformLoading, refreshPlatformRole]);

  if (!platformLoaded || platformLoading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.hint}>{title}</p>
      </div>
    );
  }

  if (!hasPlatformAccess) {
    return <Navigate to="/" replace />;
  }

  return children;
}
