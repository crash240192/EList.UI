// pages/auth/ActivationPage.tsx

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { activateAccount } from '@/features/auth/api';
import { apiClient } from '@/shared/api/client';
import { setPersonInfo } from '@/features/auth/registrationApi';
import { loadPendingPersonData, clearPendingPersonData } from '@/features/auth/pendingPersonData';
import { useAuthStore } from '@/app/store';
import styles from './AuthPage.module.css';
import actStyles from './ActivationPage.module.css';

const CODE_LENGTH = 6;
const RESEND_TIMEOUT = 15;

export default function ActivationPage() {
  const navigate = useNavigate();
  const { confirmActivation, logout } = useAuthStore();

  const [digits, setDigits]     = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_TIMEOUT);
  const [resending, setResending]     = useState(false);
  const [resendMsg, setResendMsg]     = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef  = useRef<ReturnType<typeof setInterval>>();

  const code = digits.join('');

  // Запускаем таймер при монтировании
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setResendTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const handleResend = async () => {
    setResending(true); setResendMsg(null);
    try {
      await apiClient.get('/api/authorization/sendActivationCode');
      setResendMsg('Код отправлен повторно');
      // Перезапускаем таймер
      setResendTimer(RESEND_TIMEOUT);
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setResendTimer(t => {
          if (t <= 1) { clearInterval(timerRef.current); return 0; }
          return t - 1;
        });
      }, 1000);
    } catch (e) {
      setResendMsg(e instanceof Error ? e.message : 'Ошибка отправки');
    } finally { setResending(false); }
  };

  const handleDigit = (index: number, value: string) => {
    const clean = value.replace(/\s/g, '').slice(-1);
    const next  = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'Enter' && code.length === CODE_LENGTH) handleSubmit();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    const next = Array(CODE_LENGTH).fill('');
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  };

  const handleSubmit = async () => {
    if (code.length < CODE_LENGTH) { setError(`Введите все ${CODE_LENGTH} символов`); return; }
    setLoading(true); setError(null);
    try {
      await activateAccount(code);
      confirmActivation();
      const pending = loadPendingPersonData();
      if (pending) { await setPersonInfo(pending).catch(() => {}); clearPendingPersonData(); }
      setSuccess(true);
      setTimeout(() => navigate('/', { replace: true }), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неверный код активации');
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  if (success) return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoWrap}><div className={styles.logoMark}>✅</div></div>
        <h1 className={styles.heading}>Аккаунт активирован!</h1>
        <p className={styles.subheading}>Переходим на главную...</p>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        <div className={styles.logoWrap}>
          <div className={styles.logoMark}>📬</div>
          <div className={styles.logoText}>EList</div>
        </div>

        <h1 className={styles.heading}>Подтверждение</h1>
        <p className={styles.subheading}>
          На ваш контакт отправлен код подтверждения. Введите его ниже.
        </p>

        <div className={actStyles.codeRow} onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input key={i}
              ref={el => { inputRefs.current[i] = el; }}
              className={`${actStyles.codeInput} ${error ? actStyles.codeError : d ? actStyles.codeFilled : ''}`}
              type="text" inputMode="numeric" maxLength={1}
              value={d} autoFocus={i === 0}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
            />
          ))}
        </div>

        {error && (
          <div className={styles.error}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>
            {error}
          </div>
        )}

        <button className={styles.submitBtn} onClick={handleSubmit}
          disabled={loading || code.length < CODE_LENGTH}>
          {loading ? <span className={styles.spinner} /> : 'Подтвердить →'}
        </button>

        {/* Повторная отправка */}
        <div className={actStyles.resendRow}>
          {resendTimer > 0 ? (
            <span className={actStyles.resendHint}>
              Выслать повторно через {resendTimer} с
            </span>
          ) : (
            <button
              className={actStyles.resendBtn}
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? 'Отправляем...' : 'Выслать код ещё раз'}
            </button>
          )}
          {resendMsg && (
            <span className={actStyles.resendOk}>{resendMsg}</span>
          )}
        </div>

        <div className={styles.switchRow}>
          <button className={styles.switchLink}
            onClick={() => { logout(); navigate('/login', { replace: true }); }}>
            ← Вернуться к входу
          </button>
        </div>
      </div>
    </div>
  );
}
