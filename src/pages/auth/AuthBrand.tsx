import { Link } from 'react-router-dom';
import brandLogo from '@/shared/assets/city_pulse_logo_opacity_small.png';
import styles from './AuthPage.module.css';

interface AuthBrandProps {
  /** Подзаголовок под логотипом */
  subtitle?: boolean;
  /** Ссылка «Мне просто посмотреть» под логотипом */
  showBrowseLink?: boolean;
}

/** Логотип (ссылка на главную) и опциональный выход к анонимному просмотру. */
export function AuthBrand({ subtitle = true, showBrowseLink = true }: AuthBrandProps) {
  return (
    <div className={styles.logoWrap}>
      <Link to="/" className={styles.logoLink} aria-label="На главную">
        <img src={brandLogo} alt="EList" className={styles.logoImg} />
      </Link>
      {subtitle && (
        <div className={styles.logoSub}>Агрегатор городских мероприятий</div>
      )}
      {showBrowseLink && (
        <Link to="/" className={styles.browseLink}>
          Мне просто посмотреть
        </Link>
      )}
    </div>
  );
}
