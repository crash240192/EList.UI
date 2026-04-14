// pages/auth/ActivationPage.tsx

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { activateAccount } from '@/features/auth/api';
import { setPersonInfo } from '@/features/auth/registrationApi';
import { loadPendingPersonData, clearPendingPersonData } from '@/features/auth/pendingPersonData';
import { useAuthStore } from '@/app/store';
import styles from './AuthPage.module.css';

const CODE_LENGTH = 6;

export default function ActivationPage() {
  const navigate = useNavigate();
  const { confirmActivation, logout } = useAuthStore();

  const [digits, setDigits]   = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRefs             = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join('');

  const handleDigit = (index: number, value: string) => {
    const clean = value.replace(/\s/g, '').slice(-1);
    const next  = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter' && code.length === CODE_LENGTH) {
      handleSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\s/g, '').slice(0, CODE_LENGTH);
    const next = [...digits];
    pasted.split('').forEach((ch, i) => { if (i < CODE_LENGTH) next[i] = ch; });
    setDigits(next);
    const focusIndex = Math.min(pasted.length, CODE_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleSubmit = async () => {
    if (code.length < CODE_LENGTH) {
      setError(`Введите код из ${CODE_LENGTH} символов`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await activateAccount(code);
      confirmActivation();

      // После активации — отправляем ранее сохранённые персональные данные
      const pendingPerson = loadPendingPersonData();
      if (pendingPerson) {
        await setPersonInfo(pendingPerson).catch(() => {});
        clearPendingPersonData();
      }

      setSuccess(true);
      setTimeout(() => navigate('/', { replace: true }), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неверный код активации');
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>{success ? '✅' : '📬'}</span>
          <span className={styles.logoText}>Активация</span>
        </div>

        {success ? (
          <p className={styles.subtitle} style={{ color: 'var(--success)' }}>
            Аккаунт активирован! Переходим...
          </p>
        ) : (
          <>
            <p className={styles.subtitle}>
              На ваш контакт отправлен код подтверждения.<br />Введите его ниже.
            </p>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.codeRow} onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  className={`${styles.codeInput} ${error ? styles.codeError : ''}`}
                  type="text"
                  inputMode="text"
                  maxLength={1}
                  value={d}
                  autoFocus={i === 0}
                  onChange={e => handleDigit(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                />
              ))}
            </div>

            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={loading || code.length < CODE_LENGTH}
            >
              {loading ? <span className={styles.spinner} /> : 'Подтвердить'}
            </button>

            <p className={styles.hint}>
              <button
                className={styles.linkBtn}
                onClick={() => { logout(); navigate('/login', { replace: true }); }}
              >
                ← Вернуться к входу
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
