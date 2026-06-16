// pages/auth/LoginPage.tsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '@/features/auth/api';
import { storeActivationNotice, takeActivationNotice } from '@/features/auth/activationNotice';
import { useAuthStore } from '@/app/store';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import brandLogo from '@/shared/assets/city_pulse_logo_opacity_small.png';
import styles from './AuthPage.module.css';

export default function LoginPage() {
  const navigate     = useNavigate();
  const { setAuth }  = useAuthStore();

  const [form, setForm]     = useState({ login: '', password: '' });
  const [loading, setLoad]  = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [showPass, setShow] = useState(false);
  const [activationNotice, setActivationNotice] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!form.login.trim() || !form.password.trim()) { setError('Введите логин и пароль'); return; }
    setLoad(true); setError(null);
    try {
      const r = await login({ login: form.login, password: form.password });
      setAuth(r.token, r.activationRequired);
      if (r.activationRequired) {
        if (r.message) {
          storeActivationNotice(r.message);
          setActivationNotice(r.message);
          return;
        }
        navigate('/activate', { replace: true });
        return;
      }
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неверный логин или пароль');
    } finally { setLoad(false); }
  };

  const onKey = (e: React.KeyboardEvent) => e.key === 'Enter' && handleSubmit();

  return (
    <>
    <div className={styles.page}>
      <div className={styles.card}>

        {/* Лого */}
        <div className={styles.logoWrap}>
          <img src={brandLogo} alt="EList" className={styles.logoImg} />
          <div className={styles.logoSub}>Агрегатор городских мероприятий</div>
        </div>

        <h1 className={styles.heading}>Добро пожаловать</h1>
        <p className={styles.subheading}>Войдите в аккаунт чтобы продолжить</p>

        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.label}>Логин</label>
            <input className={styles.input} placeholder="Ваш логин"
              value={form.login} onChange={set('login')} onKeyDown={onKey}
              autoComplete="username" autoCapitalize="none" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Пароль</label>
            <div className={styles.inputWrap}>
              <input
                className={`${styles.input} ${styles.inputWithBtn}`}
                type={showPass ? 'text' : 'password'}
                placeholder="Ваш пароль"
                value={form.password} onChange={set('password')} onKeyDown={onKey}
                autoComplete="current-password"
              />
              <button className={styles.eyeBtn} tabIndex={-1} onClick={() => setShow(s => !s)}>
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {error && (
            <div className={styles.error}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>
              {error}
            </div>
          )}

          <button className={styles.submitBtn} onClick={handleSubmit} disabled={loading}>
            {loading ? <span className={styles.spinner} /> : 'Войти'}
          </button>
        </div>

        <div className={styles.switchRow}>
          Нет аккаунта?
          <button className={styles.switchLink} onClick={() => navigate('/register')}>
            Зарегистрироваться
          </button>
        </div>
      </div>
    </div>

    {activationNotice && (
      <ConfirmDialog
        title="Подтверждение аккаунта"
        message={activationNotice}
        confirmLabel="Понятно"
        hideCancel
        variant="accent"
        onConfirm={() => {
          takeActivationNotice();
          setActivationNotice(null);
          navigate('/activate', { replace: true });
        }}
        onCancel={() => {}}
      />
    )}
    </>
  );
}
