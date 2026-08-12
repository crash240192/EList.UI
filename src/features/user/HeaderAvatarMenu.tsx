// features/user/HeaderAvatarMenu.tsx
// Аватар в хедере: на десктопе — переход в профиль, на мобилке — выпадающее меню

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '@/app/store';
import { useMyAvatar } from '@/features/auth/useAvatar';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { UserAgreementsInfoButton } from '@/features/agreements';
import { BugReportModal } from '@/features/bug-reports/BugReportModal';
import { useMediaQuery } from '@/shared/hooks';
import { media } from '@/shared/lib/breakpoints';
import styles from './HeaderAvatarMenu.module.css';

export function HeaderAvatarMenu() {
  const isMobile = useMediaQuery(media.mobile);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeStore();
  const myAvatar = useMyAvatar();
  const myAvatarFileId = myAvatar.fileId;

  const [menuOpen, setMenuOpen] = useState(false);
  const [bugOpen, setBugOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [menuOpen]);

  const handleAvatarClick = () => {
    if (isMobile) {
      setMenuOpen(v => !v);
      return;
    }
    navigate('/user/me');
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.avatarBtn}
        onClick={handleAvatarClick}
        aria-label={isMobile ? 'Меню профиля' : 'Профиль'}
        aria-expanded={isMobile ? menuOpen : undefined}
        aria-haspopup={isMobile ? 'menu' : undefined}
      >
        {myAvatarFileId
          ? <AuthImage fileId={myAvatarFileId} alt="Аватар" className={styles.avatarImg} />
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.avatarFallback} aria-hidden>
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
        }
      </button>

      {isMobile && menuOpen && (
        <div className={styles.menu} role="menu" aria-label="Меню профиля">
          <button
            type="button"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => {
              closeMenu();
              navigate('/user/me');
            }}
          >
            <UserIcon />
            <span>Мой профиль</span>
          </button>

          <div className={styles.themeRow}>
            <ThemeIcon />
            <span className={styles.themeLabel}>
              {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            </span>
            <button
              type="button"
              className={styles.themeToggle}
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
              title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            >
              <div className={`${styles.themeTrack} ${theme === 'light' ? styles.themeTrackLight : ''}`}>
                <div className={styles.themeThumb} />
              </div>
            </button>
          </div>

          <div className={styles.menuSeparator} role="separator" />

          <button
            type="button"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => {
              closeMenu();
              setBugOpen(true);
            }}
          >
            <BugIcon />
            <span>Сообщить об ошибке</span>
          </button>

          <button
            type="button"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => {
              closeMenu();
              setDocsOpen(true);
            }}
          >
            <InfoIcon />
            <span>Условия использования</span>
          </button>
        </div>
      )}

      {bugOpen && <BugReportModal onClose={() => setBugOpen(false)} />}

      <UserAgreementsInfoButton
        hideTrigger
        panelOpen={docsOpen}
        onPanelOpenChange={setDocsOpen}
      />
    </div>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ThemeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function BugIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 9V8a4 4 0 0 1 8 0v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="7" y="9" width="10" height="10" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M12 13v3M4 12h3M17 12h3M5 7l2 2M19 7l-2 2M5 19l2-2M19 19l-2-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="8" r="1.35" fill="currentColor" />
      <path d="M12 11v5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
