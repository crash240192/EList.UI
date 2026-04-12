// pages/auth/LoginPage.tsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '@/features/auth/api';
import { useAuthStore } from '@/app/store';
import styles from './AuthPage.module.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [form, setForm]       = useState({ login: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async () => {
    if (!form.login.trim() || !form.password.trim()) {
      setError('Введите логин и пароль');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await login({ login: form.login, password: form.password });
      setAuth(result.token, result.activationRequired);

      if (result.activationRequired) {
        navigate('/activate', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logo}>
          <span className={styles.logoIcon}>📍</span>
          <span className={styles.logoText}>EList</span>
        </div>
        <p className={styles.subtitle}>Войдите, чтобы участвовать в событиях</p>

        {/* Error */}
        {error && <div className={styles.error}>{error}</div>}

        {/* Fields */}
        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.label}>Логин</label>
            <input
              className={styles.input}
              type="text"
              placeholder="Ваш логин"
              value={form.login}
              autoComplete="username"
              autoFocus
              onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
              onKeyDown={handleKey}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Пароль</label>
            <div className={styles.passWrap}>
              <input
                className={styles.input}
                type={showPass ? 'text' : 'password'}
                placeholder="Ваш пароль"
                value={form.password}
                autoComplete="current-password"
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                onKeyDown={handleKey}
              />
              <button
                className={styles.eyeBtn}
                type="button"
                onClick={() => setShowPass(v => !v)}
                tabIndex={-1}
                aria-label={showPass ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? <span className={styles.spinner} /> : 'Войти'}
        </button>

        {/* Register link */}
        <p className={styles.hint}>
          Нет аккаунта?{' '}
          <button className={styles.linkBtn} onClick={() => navigate('/register')}>
            Зарегистрироваться
          </button>
        </p>
      </div>
    </div>
  );
}
