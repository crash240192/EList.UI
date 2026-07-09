// shared/ui/TestModeBanner/TestModeBanner.tsx

import { useEffect } from 'react';
import {
  SHOW_TEST_MODE_BANNER,
  TEST_MODE_BANNER_HEIGHT_PX,
} from '@/shared/lib/testModeBanner';
import styles from './TestModeBanner.module.css';

export function TestModeBanner() {
  useEffect(() => {
    if (!SHOW_TEST_MODE_BANNER) return;

    const root = document.documentElement;
    root.classList.add('test-mode-banner');
    root.style.setProperty('--test-banner-h', `${TEST_MODE_BANNER_HEIGHT_PX}px`);

    return () => {
      root.classList.remove('test-mode-banner');
      root.style.removeProperty('--test-banner-h');
    };
  }, []);

  if (!SHOW_TEST_MODE_BANNER) return null;

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <svg
        className={styles.icon}
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span className={styles.text}>
        Сайт работает в тестовом режиме — идёт разработка, возможны сбои
      </span>
    </div>
  );
}
