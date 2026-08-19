// pages/auth/ActivationPage.tsx

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { activateAccount } from '@/features/auth/api';
import { apiClient, ApiError } from '@/shared/api/client';
import { ApiErrorCode } from '@/shared/api/errorCodes';
import { setPersonInfo } from '@/features/auth/registrationApi';
import { loadPendingPersonData, clearPendingPersonData } from '@/features/auth/pendingPersonData';
import { takeActivationNotice } from '@/features/auth/activationNotice';
import { useAuthStore } from '@/app/store';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { OtpCodeInput } from '@/shared/ui/OtpCodeInput';
import { usePageTitle } from '@/shared/hooks';
import brandLogo from '@/shared/assets/city_pulse_logo_opacity_small.png';
import styles from './AuthPage.module.css';
import actStyles from './ActivationPage.module.css';

const CODE_LENGTH = 6;
const RESEND_TIMEOUT = 15;

function readActivationSendMessage(result: unknown): string | null {
  if (typeof result === 'string') {
    const text = result.trim();
    return text || null;
  }
  return null;
}

export default function ActivationPage() {
  usePageTitle('Активация аккаунта');
  const navigate = useNavigate();
  const { confirmActivation, logout } = useAuthStore();

  const [code, setCode]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_TIMEOUT);
  const [resending, setResending]     = useState(false);
  const [resendMsg, setResendMsg]     = useState<string | null>(null);
  const [entryNotice, setEntryNotice] = useState<string | null>(() => takeActivationNotice());
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval>>();

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
      const data = await apiClient.get<string>('/api/authorization/sendActivationCode');
      setResendMsg(
        readActivationSendMessage(data.result)
        ?? (data.message?.trim() || 'Код отправлен повторно'),
      );
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
      if (err instanceof ApiError && err.code === ApiErrorCode.ContentReportPenaltyActive) {
        setBlockedMessage(err.serverMessage || 'Аккаунт заблокирован модерацией');
      } else {
        setError(err instanceof Error ? err.message : 'Неверный код активации');
      }
      setCode('');
    } finally { setLoading(false); }
  };

  if (success) return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoWrap}><img src={brandLogo} alt="EList" className={styles.logoImg} /></div>
        <h1 className={styles.heading}>Аккаунт активирован!</h1>
        <p className={styles.subheading}>Переходим на главную...</p>
      </div>
    </div>
  );

  return (
    <>
    <div className={styles.page}>
      <div className={styles.card}>

        <div className={styles.logoWrap}>
          <img src={brandLogo} alt="EList" className={styles.logoImg} />
        </div>

        <h1 className={styles.heading}>Подтверждение</h1>
        <p className={styles.subheading}>
          На ваш контакт отправлен код подтверждения. Введите его ниже.
        </p>

        <OtpCodeInput
          value={code}
          onChange={next => { setCode(next); setError(null); }}
          error={!!error}
          disabled={loading}
          onSubmit={() => void handleSubmit()}
        />

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

    {blockedMessage && (
      <ConfirmDialog
        title="Аккаунт заблокирован"
        message={blockedMessage}
        confirmLabel="Выйти"
        hideCancel
        variant="danger"
        onConfirm={() => {
          setBlockedMessage(null);
          logout();
          navigate('/login', { replace: true });
        }}
        onCancel={() => {}}
      />
    )}

    {entryNotice && (
      <ConfirmDialog
        title="Подтверждение аккаунта"
        message={entryNotice}
        confirmLabel="Понятно"
        hideCancel
        variant="accent"
        onConfirm={() => setEntryNotice(null)}
        onCancel={() => {}}
      />
    )}
    </>
  );
}
