import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import brandLogo from '@/shared/assets/city_pulse_logo_opacity_small.png';
import { BRAND_NAME, BRAND_TAGLINE } from '@/shared/config/brand';
import styles from './AuthPage.module.css';

interface AuthBrandProps {
  /** Подзаголовок под логотипом */
  subtitle?: boolean;
  /** Кнопка возврата к карте событий */
  showBrowseLink?: boolean;
}

function preventImageSave(e: MouseEvent) {
  e.preventDefault();
}

/** PNG логотипа без системного меню «Сохранить изображение». */
export function AuthLogoImg() {
  return <img src={brandLogo} alt={BRAND_NAME} className={styles.logoImg} draggable={false} />;
}

/** Логотип (ссылка на главную) и опциональный выход к карте. */
export function AuthBrand({ subtitle = true, showBrowseLink = true }: AuthBrandProps) {
  return (
    <div className={styles.logoWrap}>
      <Link
        to="/"
        className={styles.logoLink}
        aria-label="На главную — карта событий"
        onContextMenu={preventImageSave}
      >
        <AuthLogoImg />
      </Link>
      {subtitle && (
        <div className={styles.logoSub}>{BRAND_TAGLINE}</div>
      )}
      {showBrowseLink && (
        <Link to="/" className={styles.browseBtn}>
          <MapIcon />
          Вернуться к карте
        </Link>
      )}
    </div>
  );
}

function MapIcon() {
  return (
    <svg
      className={styles.browseBtnIcon}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  );
}
