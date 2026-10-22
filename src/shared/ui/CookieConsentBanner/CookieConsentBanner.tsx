// shared/ui/CookieConsentBanner/CookieConsentBanner.tsx
// Уведомление о cookies + «ОК»; после согласия загружается Яндекс.Метрика.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  acceptCookieConsent,
  hasCookieConsent,
  initYandexMetrika,
} from '@/shared/lib/yandexMetrika';
import styles from './CookieConsentBanner.module.css';

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(() => !hasCookieConsent());

  useEffect(() => {
    if (!visible) initYandexMetrika();
  }, [visible]);

  if (!visible) return null;

  const onOk = () => {
    acceptCookieConsent();
    setVisible(false);
  };

  return createPortal(
    <div
      className={styles.banner}
      role="dialog"
      aria-live="polite"
      aria-label="Уведомление о cookies"
    >
      <p className={styles.text}>
        Мы используем cookies для работы сайта и сбора статистики посещений
        (Яндекс.Метрика). Подробнее — в{' '}
        <Link to="/cookies">политике cookies</Link>.
      </p>
      <button type="button" className={styles.okBtn} onClick={onOk}>
        ОК
      </button>
    </div>,
    document.body,
  );
}
