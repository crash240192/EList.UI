// pages/auth/RegisterPage.tsx
// Двухшаговая регистрация:
//   Шаг 1 — логин, пароль, контакт, город + согласия (Consent / Agreement)
//   Шаг 2 — ФИО, пол, дата рождения (обязательна, возраст ≥ 14)
//   Финал — createAccount → login → agree ×2 → setPersonInfo → /activate или /

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchContactTypes,
  createAccount,
  setPersonInfo,
  type IContactType,
} from '@/features/auth/registrationApi';
import { login } from '@/features/auth/api';
import { storeActivationNotice } from '@/features/auth/activationNotice';
import { useAuthStore } from '@/app/store';
import { useGeoCity, type ICity } from '@/features/auth/useGeoCity';
import { savePendingPersonData } from '@/features/auth/pendingPersonData';
import { cookies } from '@/shared/lib/cookies';
import { validateContactValue, isRegexMask, resolveContactMaskTemplate, composeContactValue } from '@/shared/lib/contactMask';
import { PasswordVisibilityButton } from '@/shared/ui/PasswordVisibilityButton';
import { usePageTitle } from '@/shared/hooks';
import { ContactMaskField } from '@/shared/ui/ContactMaskField/ContactMaskField';
import { Select } from '@/shared/ui/Select/Select';
import { DatePicker } from '@/shared/ui/DatePicker/DatePicker';
import { birthDateToApiIso, getAge, todayLocalDateString } from '@/shared/lib/datetime';
import { CitySearch } from '@/shared/ui/CitySearch/CitySearch';
import type { Gender } from '@/shared/api/types';
import {
  DocumentType,
  agreeDocument,
  fetchLastDocument,
  type DocumentTypeValue,
  type IAgreementDocument,
} from '@/entities/agreement';
import { AgreementDocumentModal } from '@/features/agreements';
import { AuthBrand } from './AuthBrand';
import styles from './AuthPage.module.css';
import regStyles from './RegisterPage.module.css';

interface Step1Form {
  login: string;
  password: string;
  passwordConfirmation: string;
  contactTypeId: string;
  contactValue: string;
}

interface Step2Form {
  firstName: string;
  lastName: string;
  patronymic: string;
  gender: Gender | '';
  birthDate: string;
}

/** Возвращает понятный пример вместо regex-маски */
function getContactPlaceholder(ct: import('@/features/auth/registrationApi').IContactType | undefined): string {
  if (!ct) return 'Введите контакт';
  const name = (ct.name || ct.localizedName || ct.namePath || '').toLowerCase();
  if (name.includes('email') || name.includes('почт') || name.includes('mail'))
    return 'example@mail.ru';
  if (name.includes('telegram') || name.includes('tg'))
    return '@username';
  if (name.includes('телефон') || name.includes('phone') || name.includes('мобил'))
    return '+7 (999) 123-45-67';
  if (name.includes('vk') || name.includes('вконтакте'))
    return 'vk.com/id или @username';
  if (name.includes('whatsapp'))
    return '+7 (999) 123-45-67';
  if (ct.mask && isRegexMask(ct.mask))
    return `Введите ${ct.name ?? 'контакт'}`;
  const template = resolveContactMaskTemplate(ct.mask, ct.name || ct.localizedName || '');
  if (template) return template;
  return `Введите ${ct.name ?? 'контакт'}`;
}

function contactTypeLabel(ct: IContactType | undefined): string {
  return ct?.name || ct?.localizedName || ct?.namePath || '';
}

function contactSubmitValue(ct: IContactType | undefined, raw: string): string {
  const template = resolveContactMaskTemplate(ct?.mask ?? null, contactTypeLabel(ct));
  const trimmed = raw.trim();
  if (!template) return trimmed;
  return composeContactValue(template, trimmed);
}

export default function RegisterPage() {
  usePageTitle('Регистрация');
  const navigate    = useNavigate();
  const { setAuth } = useAuthStore();

  const [step, setStep]         = useState<1 | 2>(1);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [ageBlocked, setAgeBlocked] = useState(false);

  const [savedCreds, setSavedCreds] = useState({ login: '', password: '' });
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  const [docModal, setDocModal] = useState<{
    open: boolean;
    loading: boolean;
    error: string | null;
    doc: IAgreementDocument | null;
  }>({ open: false, loading: false, error: null, doc: null });

  const [contactTypes, setContactTypes]       = useState<IContactType[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);

  const { detectedCity, detectedCoords, loading: geoLoading } = useGeoCity();
  const [cityManuallySelected, setCityManuallySelected] = useState(false);
  const [selectedCity, setSelectedCity] = useState<ICity | null>(null);

  useEffect(() => {
    if (detectedCity && !cityManuallySelected) setSelectedCity(detectedCity);
  }, [detectedCity, cityManuallySelected]);

  const finalCoords = selectedCity
    ? { lat: selectedCity.lat, lng: selectedCity.lng }
    : detectedCoords ?? null;

  const [form1, setForm1] = useState<Step1Form>({
    login: '', password: '', passwordConfirmation: '',
    contactTypeId: '', contactValue: '',
  });
  const [contactError, setContactError] = useState<string | null>(null);

  const handleContactBlur = () => {
    const mask = selectedContactType?.mask ?? null;
    const err = validateContactValue(form1.contactValue, mask, contactTypeLabel(selectedContactType));
    if (err && form1.contactValue.trim()) setContactError(err);
  };

  const [form2, setForm2] = useState<Step2Form>({
    firstName: '', lastName: '', patronymic: '', gender: '', birthDate: '',
  });

  useEffect(() => {
    let cancelled = false;
    fetchContactTypes()
      .then(types => {
        if (cancelled) return;
        setContactTypes(types);
        if (types.length > 0) setForm1(f => ({ ...f, contactTypeId: types[0].id }));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setContactsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const selectedContactType = contactTypes.find(ct => ct.id === form1.contactTypeId);
  const canProceedStep1 = consentAccepted && agreementAccepted;

  const set1 = (key: keyof Step1Form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm1(f => ({ ...f, [key]: e.target.value }));

  const set2 = (key: keyof Step2Form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm2(f => ({ ...f, [key]: e.target.value }));

  function validateStep1(): string | null {
    if (!form1.login.trim())       return 'Введите логин';
    if (form1.login.length < 3)    return 'Логин — не менее 3 символов';
    if (!form1.password)           return 'Введите пароль';
    if (form1.password.length < 6) return 'Пароль — не менее 6 символов';
    if (form1.password !== form1.passwordConfirmation) return 'Пароли не совпадают';
    if (!form1.contactTypeId)      return 'Выберите тип контакта';
    const maskErr = validateContactValue(
      form1.contactValue,
      selectedContactType?.mask ?? null,
      contactTypeLabel(selectedContactType),
    );
    if (maskErr) return maskErr;
    if (!consentAccepted || !agreementAccepted) {
      return 'Необходимо принять оба соглашения';
    }
    return null;
  }

  function validateStep2(): string | null {
    if (!form2.birthDate) return 'Укажите дату рождения';
    if (getAge(form2.birthDate) < 14) {
      return 'Регистрация доступна только по достижению 14 лет';
    }
    return null;
  }

  const openDocument = async (type: DocumentTypeValue) => {
    setDocModal({ open: true, loading: true, error: null, doc: null });
    try {
      const doc = await fetchLastDocument(type);
      if (!doc) {
        setDocModal({ open: true, loading: false, error: 'Документ не найден', doc: null });
        return;
      }
      setDocModal({ open: true, loading: false, error: null, doc });
    } catch (e) {
      setDocModal({
        open: true,
        loading: false,
        error: e instanceof Error ? e.message : 'Не удалось загрузить документ',
        doc: null,
      });
    }
  };

  // ---- Шаг 1: только валидация, без запросов на создание аккаунта ----
  const handleStep1 = () => {
    const err = validateStep1();
    if (err) { setError(err); return; }
    setError(null);
    setSavedCreds({ login: form1.login.trim(), password: form1.password });
    if (finalCoords) {
      cookies.set('elist_user_lat', finalCoords.lat.toFixed(6), 30);
      cookies.set('elist_user_lng', finalCoords.lng.toFixed(6), 30);
    }
    setStep(2);
  };

  // ---- Финал: createAccount → login → agree → setPersonInfo ----
  const finishRegistration = async () => {
    const step2Err = validateStep2();
    if (step2Err) {
      setError(step2Err);
      if (form2.birthDate && getAge(form2.birthDate) < 14) {
        setAgeBlocked(true);
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createAccount({
        login:                     form1.login.trim(),
        password:                  form1.password,
        passwordConfirmation:      form1.passwordConfirmation,
        authorizationContactType:  form1.contactTypeId,
        authorizationContactValue: contactSubmitValue(selectedContactType, form1.contactValue),
        showContact:               true,
        latitude:  finalCoords?.lat ?? undefined,
        longitude: finalCoords?.lng ?? undefined,
      });

      const authResult = await login(savedCreds.login
        ? savedCreds
        : { login: form1.login.trim(), password: form1.password });
      setAuth(authResult.token, authResult.activationRequired);

      await agreeDocument(DocumentType.Consent);
      await agreeDocument(DocumentType.Agreement);

      const personPayload = {
        firstName:  form2.firstName.trim()  || undefined,
        lastName:   form2.lastName.trim()   || undefined,
        patronymic: form2.patronymic.trim() || undefined,
        gender:     form2.gender            || undefined,
        birthDate:  birthDateToApiIso(form2.birthDate),
      };

      const hasPersonData = Boolean(
        personPayload.firstName || personPayload.lastName ||
        personPayload.patronymic || personPayload.gender || personPayload.birthDate,
      );

      if (authResult.activationRequired) {
        if (hasPersonData) {
          savePendingPersonData(personPayload);
        }
        if (authResult.message) {
          storeActivationNotice(authResult.message);
        }
        navigate('/activate', { replace: true });
        return;
      }

      if (hasPersonData) {
        await setPersonInfo(personPayload).catch(() => { /* не критично */ });
      }

      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка при регистрации');
    } finally {
      setLoading(false);
    }
  };

  if (ageBlocked) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <AuthBrand />
          <h1 className={styles.heading}>Регистрация недоступна</h1>
          <p className={styles.subheading}>
            Регистрация доступна только по достижению 14 лет
          </p>
          <button className={styles.submitBtn} onClick={() => navigate('/login')}>
            На страницу входа
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <AuthBrand />

        <div className={regStyles.stepRow}>
          <div className={`${regStyles.stepDot} ${step >= 1 ? regStyles.stepDotActive : ''}`}>1</div>
          <div className={`${regStyles.stepLine} ${step >= 2 ? regStyles.stepLineActive : ''}`} />
          <div className={`${regStyles.stepDot} ${step >= 2 ? regStyles.stepDotActive : ''}`}>2</div>
        </div>

        <h1 className={styles.heading}>
          {step === 1 ? 'Создайте аккаунт' : 'Расскажите о себе'}
        </h1>
        <p className={styles.subheading}>
          {step === 1 ? 'Шаг 1 из 2 — основные данные' : 'Шаг 2 из 2 — личная информация'}
        </p>

        {error && (
          <div className={styles.error}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>
            {error}
          </div>
        )}

        {step === 1 && (
          <>
            <div className={styles.fields}>
              <Field label="Логин">
                <input className={styles.input} placeholder="Придумайте логин"
                  value={form1.login} autoFocus autoComplete="username"
                  autoCapitalize="none"
                  onChange={set1('login')} onKeyDown={e => e.key === 'Enter' && handleStep1()} />
              </Field>

              <Field label="Пароль">
                <div className={styles.inputWrap}>
                  <input className={`${styles.input} ${styles.inputWithBtn}`}
                    type={showPass ? 'text' : 'password'}
                    placeholder="Не менее 6 символов" value={form1.password}
                    autoComplete="new-password" onChange={set1('password')}
                    onKeyDown={e => e.key === 'Enter' && handleStep1()} />
                  <PasswordVisibilityButton
                    visible={showPass}
                    onToggle={() => setShowPass(v => !v)}
                    className={styles.eyeBtn}
                  />
                </div>
              </Field>

              <Field label="Подтверждение пароля">
                <div className={styles.inputWrap}>
                  <input
                    className={`${styles.input} ${styles.inputWithBtn}`}
                    type={showPass ? 'text' : 'password'}
                    placeholder="Повторите пароль"
                    value={form1.passwordConfirmation}
                    autoComplete="new-password"
                    onChange={set1('passwordConfirmation')}
                    onKeyDown={e => e.key === 'Enter' && handleStep1()}
                  />
                  <PasswordVisibilityButton
                    visible={showPass}
                    onToggle={() => setShowPass(v => !v)}
                    className={styles.eyeBtn}
                  />
                </div>
              </Field>

              <Field label="Тип контакта">
                {contactsLoading
                  ? <div className={regStyles.loadingSelect}>Загрузка...</div>
                  : (
                    <Select
                      value={form1.contactTypeId}
                      onChange={v => setForm1(f => ({ ...f, contactTypeId: v, contactValue: '' }))}
                      options={contactTypes.map(ct => ({ value: ct.id, label: ct.name || ct.localizedName || '' }))}
                    />
                  )}
              </Field>

              <Field label={selectedContactType?.name || selectedContactType?.localizedName || 'Контакт'}>
                <div className={`${styles.input} ${regStyles.contactMaskWrap} ${contactError ? styles.inputError : ''}`}>
                  <ContactMaskField
                    mask={selectedContactType?.mask ?? null}
                    typeName={selectedContactType?.name || selectedContactType?.localizedName || ''}
                    value={form1.contactValue}
                    onChange={raw => {
                      setForm1(f => ({ ...f, contactValue: raw }));
                      if (contactError) setContactError(null);
                    }}
                    onBlur={handleContactBlur}
                    ariaLabel={getContactPlaceholder(selectedContactType)}
                  />
                </div>
                {contactError && (
                  <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>{contactError}</p>
                )}
              </Field>

              <Field label="Ваш город">
                <CitySearch
                  value={selectedCity?.name ?? ''}
                  onSelect={city => { setSelectedCity(city); setCityManuallySelected(true); }}
                  geoLoading={geoLoading}
                  detectedCoords={detectedCoords}
                  onAutoDetect={detectedCity ? () => { setSelectedCity(detectedCity); setCityManuallySelected(false); } : undefined}
                />
              </Field>

              <div className={regStyles.agreements}>
                <label className={regStyles.agreeRow}>
                  <input
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={e => setConsentAccepted(e.target.checked)}
                  />
                  <span>
                    Согласен на обработку персональных данных.{' '}
                    <button
                      type="button"
                      className={regStyles.docLink}
                      onClick={(e) => { e.preventDefault(); void openDocument(DocumentType.Consent); }}
                    >
                      Читать
                    </button>
                  </span>
                </label>
                <label className={regStyles.agreeRow}>
                  <input
                    type="checkbox"
                    checked={agreementAccepted}
                    onChange={e => setAgreementAccepted(e.target.checked)}
                  />
                  <span>
                    Согласен с условиями пользовательского соглашения.{' '}
                    <button
                      type="button"
                      className={regStyles.docLink}
                      onClick={(e) => { e.preventDefault(); void openDocument(DocumentType.Agreement); }}
                    >
                      Читать
                    </button>
                  </span>
                </label>
              </div>
            </div>

            <button
              className={styles.submitBtn}
              style={{ marginTop: 14 }}
              onClick={handleStep1}
              disabled={!canProceedStep1}
            >
              Далее →
            </button>

            <div className={styles.switchRow}>
              Уже есть аккаунт?
              <button className={styles.switchLink} onClick={() => navigate('/login')}>Войти</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className={styles.fields}>
              <Field label="Фамилия">
                <input className={styles.input} placeholder="Введите фамилию"
                  value={form2.lastName} autoFocus onChange={set2('lastName')} />
              </Field>
              <Field label="Имя">
                <input className={styles.input} placeholder="Введите имя"
                  value={form2.firstName} onChange={set2('firstName')} />
              </Field>
              <Field label="Отчество">
                <input className={styles.input} placeholder="Необязательно"
                  value={form2.patronymic} onChange={set2('patronymic')} />
              </Field>
              <Field label="Пол">
                <Select
                  value={form2.gender}
                  onChange={v => setForm2(f => ({...f, gender: v as '' | 'Male' | 'Female'}))}
                  placeholder="Не указан"
                  options={[{ value: 'Male', label: 'Мужской' }, { value: 'Female', label: 'Женский' }]}
                />
              </Field>
              <Field label="Дата рождения">
                <DatePicker
                  value={form2.birthDate}
                  onChange={iso => setForm2(f => ({ ...f, birthDate: iso }))}
                  placeholder="дд.мм.гггг"
                  min="1900-01-01"
                  max={todayLocalDateString()}
                  autoComplete="bday"
                  name="bday"
                />
              </Field>
            </div>

            <button
              className={styles.submitBtn}
              style={{ marginTop: 14 }}
              onClick={() => { void finishRegistration(); }}
              disabled={loading || !form2.birthDate}
            >
              {loading ? <span className={styles.spinner} /> : 'Сохранить и войти'}
            </button>

            <button
              type="button"
              className={regStyles.backBtn}
              style={{ marginTop: 6 }}
              onClick={() => { setStep(1); setError(null); }}
              disabled={loading}
            >
              ← Назад
            </button>
          </>
        )}
      </div>

      {docModal.open && (
        <AgreementDocumentModal
          doc={docModal.doc}
          loading={docModal.loading}
          error={docModal.error}
          onClose={() => setDocModal(m => ({ ...m, open: false }))}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {children}
    </div>
  );
}
