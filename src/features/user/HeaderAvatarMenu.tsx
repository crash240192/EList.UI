// features/user/HeaderAvatarMenu.tsx
// Аватар в хедере: выпадающее меню профиля (мобилка и десктоп)

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '@/app/store';
import { useMyAvatar } from '@/features/auth/useAvatar';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { UserAgreementsInfoButton } from '@/features/agreements';
import { BugReportModal } from '@/features/bug-reports/BugReportModal';
import { MyOrganizationsModal } from '@/features/organizations/MyOrganizationsModal';
import {
  fetchMyOrganizations,
  type OrganizationResponse,
} from '@/entities/organization';
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
  const [orgsModalOpen, setOrgsModalOpen] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationResponse[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyOrganizations()
      .then(list => {
        if (!cancelled) setOrganizations(list);
      })
      .catch(() => {
        if (!cancelled) setOrganizations([]);
      });
    return () => { cancelled = true; };
  }, []);

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

  const closeMenu = () => setMenuOpen(false);

  const openOrganizations = () => {
    closeMenu();
    if (organizations.length === 1) {
      navigate(`/organization/${organizations[0].id}`);
      return;
    }
    setOrgsModalOpen(true);
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.avatarBtn}
        onClick={() => setMenuOpen(v => !v)}
        aria-label="Меню профиля"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        {myAvatarFileId
          ? <AuthImage fileId={myAvatarFileId} alt="Аватар" className={styles.avatarImg} />
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.avatarFallback} aria-hidden>
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
        }
      </button>

      {menuOpen && (
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

          {organizations.length > 0 && (
            <button
              type="button"
              className={styles.menuItem}
              role="menuitem"
              onClick={openOrganizations}
            >
              <OrgIcon />
              <span>Мои организации</span>
            </button>
          )}

          <button
            type="button"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => {
              closeMenu();
              navigate('/my-tickets');
            }}
          >
            <TicketIcon />
            <span>Мои билеты</span>
          </button>

          <button
            type="button"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => {
              closeMenu();
              navigate('/wallet');
            }}
          >
            <WalletIcon />
            <span>Баланс</span>
          </button>

          <button
            type="button"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => {
              closeMenu();
              navigate('/settings');
            }}
          >
            <SettingsIcon />
            <span>Настройки</span>
          </button>

          {isMobile && (
            <>
              <div className={styles.menuSeparator} role="separator" />

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
                <SupportIcon />
                <span>Написать в поддержку</span>
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
            </>
          )}
        </div>
      )}

      {bugOpen && <BugReportModal onClose={() => setBugOpen(false)} />}

      <UserAgreementsInfoButton
        hideTrigger
        panelOpen={docsOpen}
        onPanelOpenChange={setDocsOpen}
      />

      {orgsModalOpen && (
        <MyOrganizationsModal
          organizations={organizations}
          onClose={() => setOrgsModalOpen(false)}
        />
      )}
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

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
      <path d="M16 3H8l-2 4h12z" />
      <circle cx="16" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a2 2 0 0 0 0 4v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a2 2 0 0 0 0-4V9z" />
      <path d="M9 7v10" strokeDasharray="2 3" />
    </svg>
  );
}

function OrgIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-6h6v6" />
      <path d="M9 10h.01M15 10h.01M9 14h.01M15 14h.01" />
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

function SupportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 100 512 312" fill="currentColor" aria-hidden>
      <path d="M217.53 408.93 C210.62 407.78 205.35 405.34 199.5 400.58 C196.75 398.35 178.98 382.34 160.01 365.01 L125.53 333.5 L114.01 333 L102.5 332.5 L102.27 243 L102.04 153.5 L131.77 133.77 C164.51 112.03 171.69 108.04 183.51 104.96 C194.59 102.08 210.61 102.07 221.46 104.93 C228.72 106.84 232.07 108.4 230.93 109.32 C230.69 109.51 215.43 121.85 197 136.73 C178.57 151.62 161.84 165.53 159.81 167.65 C147.58 180.42 141.9 200.21 145.5 217.5 C150.09 239.51 167.44 256.86 189.5 261.5 C198.33 263.35 203.68 263.35 212.5 261.49 C223.5 259.17 229.92 255.31 254 236.57 C266.38 226.94 276.82 219.16 277.2 219.28 C278.12 219.57 376.75 309.87 384.06 317.11 C404 336.87 399.67 367.65 375.25 379.72 C368.01 383.3 367.1 383.5 358.05 383.49 C349.82 383.48 347.71 383.11 342.8 380.82 L337.1 378.16 L334.14 383.41 C330.25 390.3 322.29 397.34 315.2 400.16 C310.72 401.94 307.46 402.43 300 402.46 C287.8 402.51 282.92 400.33 270.4 389.23 L261.3 381.15 L259.08 386.52 C252.58 402.2 234.76 411.81 217.53 408.93 Z M20.87 358.05 C12.1 356.44 5.14 350.65 2.04 342.38 C0.04 337.04 -0 335.08 0 249.87 C0 153.56 -0.4 159.49 6.39 155.39 C9.24 153.65 12.27 153.47 43.25 153.19 L77 152.88 L77 244.26 C77 344.55 77.16 341.75 71.01 349.19 C69.33 351.21 65.44 354.1 62.36 355.61 C57.09 358.19 55.86 358.36 41.13 358.62 C32.54 358.77 23.42 358.51 20.87 358.05 Z M455.67 357.92 C446.34 356.01 438.55 348.49 435.97 338.89 C435.35 336.6 435.08 301.46 435.24 244.37 L435.5 153.5 L469.5 153.5 C500.65 153.5 503.72 153.65 506.16 155.31 C512.24 159.44 512 155.45 511.99 251.15 L511.98 338.5 L509.62 343.5 C506.7 349.67 503 353.23 496.5 356.11 C492.15 358.05 489.47 358.37 476 358.62 C467.48 358.78 458.33 358.46 455.67 357.92 Z M43.94 331.17 C53.8 325.88 53 312.46 42.58 308.48 C38.5 306.92 37.6 306.88 34.27 308.15 C29.39 310.01 26 315.04 26 320.43 C26 325.62 28.13 328.7 33.38 331.09 C38.54 333.43 39.71 333.44 43.94 331.17 Z M478.51 331.56 C485.96 328.45 488.59 317.43 483.17 312.01 C481.61 310.46 478.49 308.63 476.24 307.95 C472.65 306.88 471.69 306.96 468.42 308.66 C458.73 313.69 458.67 326.68 468.32 331.06 C473.38 333.36 474.12 333.39 478.51 331.56 Z M353.83 253.73 C323.76 226.1 299.12 203.04 299.08 202.49 C299.04 201.93 303.01 198.41 307.92 194.67 C321.1 184.62 323.35 178.11 316.12 170.88 C312.64 167.41 311.71 167 307.22 167 L302.21 167 L260.85 199.18 C238.11 216.87 217.28 232.51 214.56 233.92 C208.03 237.31 197.42 237.97 189.86 235.45 C182.56 233.03 175.07 225.46 172.06 217.47 C169.2 209.91 169.52 198.71 172.75 192.5 C175.83 186.58 179.79 183.08 223 148.05 C265.54 113.57 272.51 108.92 287.73 104.85 C297.59 102.22 314.35 102.02 324.5 104.42 C335.26 106.96 346.88 113.27 379.5 134.29 L409.5 153.62 L409.76 228.81 C409.9 270.17 409.67 303.99 409.26 303.98 C408.84 303.97 383.9 281.36 353.83 253.73 Z" />
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
