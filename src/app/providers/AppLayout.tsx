// app/providers/AppLayout.tsx
// Корневой layout — хедер, боковая панель, контент

import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useThemeStore, useAuthStore } from '../store';
import { LogoutConfirmModal } from '@/shared/ui/LogoutConfirmModal/LogoutConfirmModal';
import styles from './AppLayout.module.css';

const NAV_ITEMS = [
  { to: '/',            label: 'Поиск событий',  icon: <SearchIcon /> },
  { to: '/my-events',   label: 'Мои события',    icon: <CalendarIcon /> },
  { to: '/create-event',label: 'Создать событие',icon: <PlusIcon /> },
  { to: '/user/me',     label: 'Мой профиль',    icon: <UserIcon /> },
  { to: '/wallet',      label: 'Кошелёк',        icon: <WalletIcon /> },
];

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const { theme, toggleTheme } = useThemeStore();
  const { isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    setLogoutConfirm(false);
    setSidebarOpen(false);
    navigate('/login', { replace: true });
  };

  // Синхронизируем класс body при монтировании
  useEffect(() => {
    document.body.classList.toggle('light-theme', theme === 'light');
  }, [theme]);

  return (
    <div className={styles.root}>
      {/* ---- Header ---- */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            className={styles.menuBtn}
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Меню"
          >
            <HamburgerIcon />
          </button>
          <div className={styles.logo}>
            <span>📍</span>
            <span>EList</span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <button className={styles.iconBtn} onClick={toggleTheme} aria-label="Переключить тему">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {isAuthenticated() ? (
            <button
              className={styles.avatarBtn}
              onClick={() => navigate('/user/me')}
              aria-label="Профиль"
            >
              <span>👤</span>
            </button>
          ) : (
            <button className={styles.loginBtn} onClick={() => navigate('/login')}>
              Войти
            </button>
          )}
        </div>
      </header>

      {/* ---- Sidebar ---- */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <nav className={styles.nav}>
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navActive : ''}`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <span className={styles.navIcon}>{icon}</span>
              <span className={styles.navLabel}>{label}</span>
            </NavLink>
          ))}
        </nav>

        {isAuthenticated() && (
          <button className={styles.logoutBtn} onClick={() => setLogoutConfirm(true)}>
            Выйти
          </button>
        )}
      </aside>

      {sidebarOpen && (
        <div className={styles.overlay} onClick={() => setSidebarOpen(false)} aria-hidden />
      )}

      {logoutConfirm && (
        <LogoutConfirmModal
          onConfirm={handleLogout}
          onCancel={() => setLogoutConfirm(false)}
        />
      )}

      {/* ---- Main content ---- */}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

// ---- Иконки (инлайн SVG) ----

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}
function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
      <path d="M16 3H8l-2 4h12z" /><circle cx="16" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}
function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
