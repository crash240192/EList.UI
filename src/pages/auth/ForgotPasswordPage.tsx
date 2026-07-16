// pages/auth/ForgotPasswordPage.tsx
// Восстановление пароля: логин → код → новый пароль → автологин

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  forgotPassword,
  verifyResetCode,
  resetPassword,
} from '@/features/auth/passwordResetApi';
import { useAuthStore } from '@/app/store';
import { PasswordVisibilityButton } from '@/shared/ui/PasswordVisibilityButton';
import { OtpCodeInput } from '@/shared/ui/OtpCodeInput';
import { usePageTitle } from '@/shared/hooks';
import { AuthBrand } from './AuthBrand';
import styles from './AuthPage.module.css';
import fpStyles from './ForgotPasswordPage.module.css';

const CODE_LENGTH = 6;
const RESEND_TIMEOUT = 15;

type Step = 'login' | 'code' | 'password' | 'success';

export default function ForgotPasswordPage() {
  usePageTitle('Восстановление пароля');
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [step, setStep] = useState<Step>('login');
  const [login, setLogin] = useState('');
  const [code, setCode] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    newPasswordConfirmation: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const startResendTimer = () => {
    setResendTimer(RESEND_TIMEOUT);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const handleSendCode = async () => {
    const trimmedLogin = login.trim();
    if (!trimmedLogin) {
      setError('Введите логин');
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const message = await forgotPassword({ login: trimmedLogin });
      setLogin(trimmedLogin);
      setCode('');
      setStep('code');
      setInfo(
        message
        ?? 'Если аккаунт с таким логином существует, код отправлен на ваш контакт',
      );
      startResendTimer();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить код');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendMsg(null);
    try {
      const message = await forgotPassword({ login });
      setResendMsg(message ?? 'Код отправлен повторно');
      startResendTimer();
    } catch (e) {
      setResendMsg(e instanceof Error ? e.message : 'Ошибка отправки');
    } finally {
      setResending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length < CODE_LENGTH) {
      setError(`Введите все ${CODE_LENGTH} цифр кода`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await verifyResetCode({ login, code });
      setStep('password');
      setInfo(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Неверный или просроченный код';
      navigate('/login', { replace: true, state: { passwordResetError: message } });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const { newPassword, newPasswordConfirmation } = passwordForm;
    if (!newPassword || !newPasswordConfirmation) {
      setError('Заполните оба поля пароля');
      return;
    }
    if (newPassword.length < 6) {
      setError('Пароль — не менее 6 символов');
      return;
    }
    if (newPassword !== newPasswordConfirmation) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await resetPassword({
        login,
        code,
        newPassword,
        newPasswordConfirmation,
      });
      setAuth(result.token, result.activationRequired);
      setStep('success');
      setTimeout(() => navigate('/', { replace: true }), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сменить пароль');
    } finally {
      setLoading(false);
    }
  };

  const onLoginKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleSendCode();
  };

  if (step === 'success') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <AuthBrand subtitle={false} showBrowseLink={false} />
          <h1 className={styles.heading}>Пароль изменён</h1>
          <p className={styles.subheading}>Выполняем вход и переходим на главную...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <AuthBrand subtitle={false} />

        {step === 'login' && (
          <>
            <h1 className={styles.heading}>Восстановление пароля</h1>
            <p className={styles.subheading}>
              Введите логин — мы отправим одноразовый код на ваш контакт
            </p>

            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.label}>Логин</label>
                <input
                  className={styles.input}
                  placeholder="Ваш логин"
                  value={login}
                  onChange={e => { setLogin(e.target.value); setError(null); }}
                  onKeyDown={onLoginKey}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoFocus
                />
              </div>

              {error && (
                <div className={styles.error}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>
                  {error}
                </div>
              )}

              <button className={styles.submitBtn} onClick={() => void handleSendCode()} disabled={loading}>
                {loading ? <span className={styles.spinner} /> : 'Отправить код'}
              </button>
            </div>
          </>
        )}

        {step === 'code' && (
          <>
            <h1 className={styles.heading}>Код подтверждения</h1>
            <p className={styles.subheading}>
              {info ?? 'Введите код, отправленный на ваш контакт'}
            </p>

            <OtpCodeInput
              value={code}
              onChange={next => { setCode(next); setError(null); }}
              error={!!error}
              disabled={loading}
              onSubmit={() => void handleVerifyCode()}
            />

            {error && (
              <div className={styles.error}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>
                {error}
              </div>
            )}

            <button
              className={styles.submitBtn}
              onClick={() => void handleVerifyCode()}
              disabled={loading || code.length < CODE_LENGTH}
            >
              {loading ? <span className={styles.spinner} /> : 'Продолжить →'}
            </button>

            <div className={fpStyles.resendRow}>
              {resendTimer > 0 ? (
                <span className={fpStyles.resendHint}>
                  Выслать повторно через {resendTimer} с
                </span>
              ) : (
                <button
                  type="button"
                  className={fpStyles.resendBtn}
                  onClick={() => void handleResend()}
                  disabled={resending}
                >
                  {resending ? 'Отправляем...' : 'Выслать код ещё раз'}
                </button>
              )}
              {resendMsg && <span className={fpStyles.resendOk}>{resendMsg}</span>}
            </div>
          </>
        )}

        {step === 'password' && (
          <>
            <h1 className={styles.heading}>Новый пароль</h1>
            <p className={styles.subheading}>Придумайте новый пароль для входа в аккаунт</p>

            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.label}>Новый пароль</label>
                <div className={styles.inputWrap}>
                  <input
                    className={`${styles.input} ${styles.inputWithBtn}`}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Не менее 6 символов"
                    value={passwordForm.newPassword}
                    autoComplete="new-password"
                    onChange={e => {
                      setPasswordForm(f => ({ ...f, newPassword: e.target.value }));
                      setError(null);
                    }}
                  />
                  <PasswordVisibilityButton
                    visible={showPassword}
                    onToggle={() => setShowPassword(v => !v)}
                    className={styles.eyeBtn}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Повторите пароль</label>
                <div className={styles.inputWrap}>
                  <input
                    className={`${styles.input} ${styles.inputWithBtn}`}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Ещё раз"
                    value={passwordForm.newPasswordConfirmation}
                    autoComplete="new-password"
                    onChange={e => {
                      setPasswordForm(f => ({ ...f, newPasswordConfirmation: e.target.value }));
                      setError(null);
                    }}
                    onKeyDown={e => e.key === 'Enter' && void handleResetPassword()}
                  />
                  <PasswordVisibilityButton
                    visible={showPassword}
                    onToggle={() => setShowPassword(v => !v)}
                    className={styles.eyeBtn}
                  />
                </div>
              </div>

              {error && (
                <div className={styles.error}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>
                  {error}
                </div>
              )}

              <button className={styles.submitBtn} onClick={() => void handleResetPassword()} disabled={loading}>
                {loading ? <span className={styles.spinner} /> : 'Сохранить и войти'}
              </button>
            </div>
          </>
        )}

        <div className={styles.switchRow}>
          <button
            type="button"
            className={styles.switchLink}
            onClick={() => navigate('/login', { replace: true })}
          >
            ← Вернуться ко входу
          </button>
        </div>
      </div>
    </div>
  );
}
