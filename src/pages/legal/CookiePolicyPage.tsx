// pages/legal/CookiePolicyPage.tsx

import { Link } from 'react-router-dom';
import { usePageTitle } from '@/shared/hooks';
import { BRAND_NAME } from '@/shared/config/brand';
import styles from './LegalDocPage.module.css';

export default function CookiePolicyPage() {
  usePageTitle('Политика cookies');

  return (
    <div className={styles.page}>
      <article className={styles.card}>
        <h1 className={styles.title}>Политика использования cookies</h1>
        <p className={styles.lead}>
          Сервис «{BRAND_NAME}» использует cookies и похожие технологии, чтобы обеспечивать
          вход в аккаунт, запоминать город и базовые настройки интерфейса.
        </p>

        <h2 className={styles.h2}>Какие cookies мы используем</h2>
        <ul className={styles.list}>
          <li>
            <strong>elist_auth_token</strong> — токен сессии (необходим для авторизации).
          </li>
          <li>
            <strong>elist_client_hash</strong> — идентификатор клиента для привязки сессии.
          </li>
          <li>
            <strong>elist_user_lat / elist_user_lng / elist_city_*</strong> — выбранный город
            и координаты для карты и фильтров.
          </li>
        </ul>

        <h2 className={styles.h2}>Согласие</h2>
        <p>
          Необходимые cookies (авторизация и безопасность сессии) устанавливаются для
          работы сервиса. Предпочтения города можно сбросить в настройках профиля или
          очистив cookies браузера.
        </p>

        <h2 className={styles.h2}>Срок хранения</h2>
        <p>
          Срок жизни cookies указан при установке (обычно от 30 дней до нескольких лет
          для стабильного client hash). После выхода из аккаунта auth-cookie удаляется.
        </p>

        <p className={styles.footer}>
          <Link to="/">На главную</Link>
          {' · '}
          <Link to="/settings">Настройки</Link>
        </p>
      </article>
    </div>
  );
}
