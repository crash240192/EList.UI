// pages/not-found/NotFoundPage.tsx

import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '@/shared/hooks';
import styles from './NotFoundPage.module.css';

export default function NotFoundPage() {
  usePageTitle('Страница не найдена');
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <div className={styles.code}>404</div>
      <h1 className={styles.title}>Страница не найдена</h1>
      <p className={styles.text}>
        Возможно, мероприятие было удалено, ссылка устарела или в адресе опечатка.
      </p>
      <div className={styles.actions}>
        <button className={styles.primaryBtn} onClick={() => navigate('/')}>
          К поиску событий
        </button>
        <button className={styles.secondaryBtn} onClick={() => navigate(-1)}>
          Назад
        </button>
      </div>
    </div>
  );
}
