import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import brandLogo from '@/shared/assets/city_pulse_logo_opacity_small.png';
import { BRAND_NAME, BRAND_TAGLINE } from '@/shared/config/brand';
import styles from './AuthPage.module.css';

interface AuthBrandProps {
  /** Подзаголовок под логотипом */
  subtitle?: boolean;
  /** Ссылка «Мне просто посмотреть» под логотипом */
  showBrowseLink?: boolean;
}

function preventImageSave(e: MouseEvent) {
  e.preventDefault();
}

/** PNG логотипа без системного меню «Сохранить изображение». */
export function AuthLogoImg() {
  return <img src={brandLogo} alt={BRAND_NAME} className={styles.logoImg} draggable={false} />;
}

/** Логотип (ссылка на главную) и опциональный выход к анонимному просмотру. */
export function AuthBrand({ subtitle = true, showBrowseLink = true }: AuthBrandProps) {
  return (
    <div className={styles.logoWrap}>
      <Link
        to="/"
        className={styles.logoLink}
        aria-label="На главную"
        onContextMenu={preventImageSave}
      >
        <AuthLogoImg />
      </Link>
      {subtitle && (
        <div className={styles.logoSub}>{BRAND_TAGLINE}</div>
      )}
      {showBrowseLink && (
        <Link to="/" className={styles.browseLink}>
          Мне просто посмотреть
        </Link>
      )}
    </div>
  );
}
