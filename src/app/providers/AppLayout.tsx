// app/providers/AppLayout.tsx

import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useThemeStore, useAuthStore, useFiltersStore } from '../store';
import { LogoutConfirmModal } from '@/shared/ui/LogoutConfirmModal/LogoutConfirmModal';
import { getStoredUserCoords } from '@/features/auth/useUserLocation';
import styles from './AppLayout.module.css';

const NAV_ITEMS = [
  { to: '/',             label: 'Поиск событий',    icon: <SearchIcon /> },
  { to: '/my-events',    label: 'Мои события',      icon: <CalendarIcon /> },
  { to: '/create-event', label: 'Создать событие',  icon: <PlusIcon /> },
  { to: '/settings',     label: 'Настройки',        icon: <SettingsIcon /> },
  { to: '/wallet',       label: 'Кошелёк',          icon: <WalletIcon /> },
  { to: '/admin',        label: 'Администрирование', icon: <AdminIcon /> },
];

export function AppLayout() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [logoutConfirm,   setLogoutConfirm]   = useState(false);
  const { theme, toggleTheme } = useThemeStore();
  const { isAuthenticated, logout } = useAuthStore();
  const { filters } = useFiltersStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    setLogoutConfirm(false);
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    document.body.classList.toggle('light-theme', theme === 'light');
  }, [theme]);

  // Закрытие sidebar по Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarExpanded(false); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);

  return (
    <div className={styles.root}>
      {/* ---- Header ---- */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            className={styles.menuBtn}
            onClick={() => setSidebarExpanded(v => !v)}
            aria-label={sidebarExpanded ? 'Свернуть меню' : 'Развернуть меню'}
            aria-expanded={sidebarExpanded}
          >
            <HamburgerIcon />
          </button>
          <button className={styles.logo} onClick={() => {
            navigate('/');
            // Приоритет: выбранный город в фильтрах → координаты пользователя
            const userCoords = getStoredUserCoords();
            const lat = filters.latitude  ?? userCoords.lat;
            const lng = filters.longitude ?? userCoords.lng;
            window.dispatchEvent(new CustomEvent('elist:centerMap', {
              detail: { lat, lng },
            }));
          }} aria-label="На главную">
            <span>📍</span>
            <span>EList</span>
          </button>
        </div>

        <div className={styles.headerRight}>
          <button className={styles.iconBtn} onClick={toggleTheme} aria-label="Переключить тему">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {isAuthenticated() ? (
            <button className={styles.avatarBtn} onClick={() => navigate('/user/me')} aria-label="Профиль">
              <span>👤</span>
            </button>
          ) : (
            <button className={styles.loginBtn} onClick={() => navigate('/login')}>Войти</button>
          )}
        </div>
      </header>

      {/* ---- Sidebar ---- */}
      <aside className={`${styles.sidebar} ${sidebarExpanded ? styles.sidebarExpanded : ''}`}>
        <nav className={styles.nav}>
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to} to={to} end={to === '/'}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
              title={label}
              onClick={() => setSidebarExpanded(false)}
            >
              <span className={styles.navIcon}>{icon}</span>
              <span className={styles.navLabel}>{label}</span>
            </NavLink>
          ))}
        </nav>

        {isAuthenticated() && (
          <button className={styles.logoutBtn} onClick={() => setLogoutConfirm(true)} title="Выйти">
            <span className={styles.navIcon}><LogoutIcon /></span>
            <span className={styles.navLabel}>Выйти</span>
          </button>
        )}
      </aside>

      {/* Backdrop — закрывает sidebar при клике вне */}
      {sidebarExpanded && (
        <div
          className={styles.backdrop}
          onClick={() => setSidebarExpanded(false)}
          aria-hidden="true"
        />
      )}

      {logoutConfirm && (
        <LogoutConfirmModal onConfirm={handleLogout} onCancel={() => setLogoutConfirm(false)} />
      )}

      {/* ---- Main ---- */}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

function SettingsIcon()  { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>; }
function AdminIcon()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>; }
function SearchIcon()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>; }
function CalendarIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
function PlusIcon()     { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>; }
function WalletIcon()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 3H8l-2 4h12z"/><circle cx="16" cy="14" r="1" fill="currentColor"/></svg>; }
function LogoutIcon()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>; }
function HamburgerIcon(){ return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>; }
