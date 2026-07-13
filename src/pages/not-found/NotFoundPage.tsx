// pages/not-found/NotFoundPage.tsx

import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '@/shared/hooks';
import { useSafeBack } from '@/shared/lib/useSafeBack';
import styles from './NotFoundPage.module.css';

export default function NotFoundPage() {
  usePageTitle('Страница не найдена');
  const navigate = useNavigate();
  const goBack = useSafeBack('/');

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
        <button className={styles.secondaryBtn} onClick={goBack}>
          Назад
        </button>
      </div>
    </div>
  );
}
