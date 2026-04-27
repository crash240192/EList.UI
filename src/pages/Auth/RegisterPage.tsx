// pages/auth/RegisterPage.tsx
// Двухшаговая регистрация:
//   Шаг 1 — логин, пароль, тип и значение контакта → createAccount
//   Шаг 2 — ФИО, пол, дата рождения (необязательно, можно скипнуть)
//   Финал — автоматический логин → setPersonInfo (если не скипнули) → /activate или /

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchContactTypes,
  createAccount,
  setPersonInfo,
  type IContactType,
} from '@/features/auth/registrationApi';
import { login } from '@/features/auth/api';
import { useAuthStore } from '@/app/store';
import { useGeoCity, type ICity } from '@/features/auth/useGeoCity';
import { savePendingPersonData } from '@/features/auth/pendingPersonData';
import { cookies } from '@/shared/lib/cookies';
import { loadYandexMaps } from '@/shared/lib/yandexMaps';
import { validateContactValue, getMaskInputMode } from '@/shared/lib/contactMask';
import { DatePicker } from '@/shared/ui/DatePicker/DatePicker';
import { CitySearch } from '@/shared/ui/CitySearch/CitySearch';
import type { Gender } from '@/shared/api/types';
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
  // Определяем по имени типа
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
  // Если маска выглядит как regex — скрываем её, показываем generic
  if (ct.mask && (ct.mask.startsWith('^') || ct.mask.includes('\\d') || ct.mask.includes('?')))
    return `Введите ${ct.name ?? 'контакт'}`;
  // Если маска — человекочитаемый пример, показываем её
  return ct.mask ?? `Введите ${ct.name ?? 'контакт'}`;
}

export default function RegisterPage() {
  const navigate    = useNavigate();
  const { setAuth } = useAuthStore();

  const [step, setStep]         = useState<1 | 2>(1);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  // Сохраняем логин/пароль для авторизации после шага 2
  const [savedCreds, setSavedCreds] = useState({ login: '', password: '' });

  const [contactTypes, setContactTypes]       = useState<IContactType[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);

  // Геолокация
  const { detectedCity, detectedCoords, loading: geoLoading } = useGeoCity();
  // Флаг — пользователь вручную менял город
  const [cityManuallySelected, setCityManuallySelected] = useState(false);
  const [selectedCity, setSelectedCity] = useState<ICity | null>(null);

  // Когда геолокация определилась — подставляем найденный город,
  // но только если пользователь ещё не выбрал сам
  useEffect(() => {
    if (detectedCity && !cityManuallySelected) setSelectedCity(detectedCity);
  }, [detectedCity, cityManuallySelected]);

  // Итоговые координаты:
  // 1. Если пользователь выбрал город вручную — берём координаты города
  // 2. Если нет — точные координаты из браузера/IP (они попадают в тот же город)
  const finalCoords = selectedCity
    ? { lat: selectedCity.lat, lng: selectedCity.lng }
    : detectedCoords ?? null;

  const [form1, setForm1] = useState<Step1Form>({
    login: '', password: '', passwordConfirmation: '',
    contactTypeId: '', contactValue: '',
  });
  const [contactError, setContactError] = useState<string | null>(null);

  // Умный обработчик поля контакта — форматирует телефон по маске
  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setForm1(f => ({ ...f, contactValue: raw }));
    if (contactError) setContactError(null);
  };

  const handleContactBlur = () => {
    const mask = selectedContactType?.mask ?? null;
    const err = validateContactValue(form1.contactValue, mask);
    if (err && form1.contactValue.trim()) setContactError(err);
  };

  const [form2, setForm2] = useState<Step2Form>({
    firstName: '', lastName: '', patronymic: '', gender: '', birthDate: '',
  });

  useEffect(() => {
    fetchContactTypes()
      .then(types => {
        setContactTypes(types);
        if (types.length > 0) setForm1(f => ({ ...f, contactTypeId: types[0].id }));
      })
      .catch(() => {})
      .finally(() => setContactsLoading(false));
  }, []);

  const selectedContactType = contactTypes.find(ct => ct.id === form1.contactTypeId);

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
    const maskErr = validateContactValue(form1.contactValue, selectedContactType?.mask ?? null);
    if (maskErr) return maskErr;
    return null;
  }

  // ---- Шаг 1: создаём аккаунт, переходим к шагу 2 ----
  const handleStep1 = async () => {
    const err = validateStep1();
    if (err) { setError(err); return; }
    setError(null);
    setLoading(true);
    try {
      await createAccount({
        login:                     form1.login.trim(),
        password:                  form1.password,
        passwordConfirmation:      form1.passwordConfirmation,
        authorizationContactType:  form1.contactTypeId,
        authorizationContactValue: form1.contactValue.trim(),
        showContact:               true,
        latitude:  finalCoords?.lat ?? undefined,
        longitude: finalCoords?.lng ?? undefined,
      });

      // Сохраняем координаты города в cookies — чтобы карта сразу открылась
      // в нужном городе, не дожидаясь загрузки из аккаунта
      if (finalCoords) {
        cookies.set('elist_user_lat', finalCoords.lat.toFixed(6), 30);
        cookies.set('elist_user_lng', finalCoords.lng.toFixed(6), 30);
      }
      setSavedCreds({ login: form1.login.trim(), password: form1.password });
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка при регистрации');
    } finally {
      setLoading(false);
    }
  };

  // ---- Финальный логин после шага 2 ----
  const finishRegistration = async (personData?: Step2Form) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Авторизуемся
      const authResult = await login(savedCreds);
      setAuth(authResult.token, authResult.activationRequired);

      // 2. Готовим объект персональных данных (если есть что отправлять)
      const personPayload = personData
        ? {
            firstName:  personData.firstName.trim()  || undefined,
            lastName:   personData.lastName.trim()   || undefined,
            patronymic: personData.patronymic.trim() || undefined,
            gender:     personData.gender            || undefined,
            birthDate:  personData.birthDate
              ? new Date(personData.birthDate).toISOString()
              : undefined,
          }
        : null;

      const hasPersonData = personPayload &&
        (personPayload.firstName || personPayload.lastName ||
         personPayload.patronymic || personPayload.gender || personPayload.birthDate);

      // 3. Если нужна активация — сохраняем персданные в sessionStorage,
      //    отправим их после активации в ActivationPage
      if (authResult.activationRequired) {
        if (hasPersonData && personPayload) {
          savePendingPersonData(personPayload);
        }
        navigate('/activate', { replace: true });
        return;
      }

      // 4. Активация не нужна — отправляем сразу
      if (hasPersonData && personPayload) {
        await setPersonInfo(personPayload)
          .catch(() => { /* не критично */ });
      }

      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка авторизации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logoWrap}>
          <div className={styles.logoMark}>📍</div>
          <div className={styles.logoText}>EList</div>
          <div className={styles.logoSub}>Агрегатор городских мероприятий</div>
        </div>

        {/* Step indicator */}
        <div className={regStyles.stepRow}>
          <div className={`${regStyles.stepDot} ${step >= 1 ? regStyles.stepDotActive : ''}`}>1</div>
          <div className={`${regStyles.stepLine} ${step >= 2 ? regStyles.stepLineActive : ''}`} />
          <div className={`${regStyles.stepDot} ${step >= 2 ? regStyles.stepDotActive : ''}`}>2</div>
        </div>

        <h1 className={styles.heading}>
          {step === 1 ? 'Создайте аккаунт' : 'Расскажите о себе'}
        </h1>
        <p className={styles.subheading}>
          {step === 1 ? 'Шаг 1 из 2 — основные данные' : 'Шаг 2 из 2 — личная информация (необязательно)'}
        </p>

        {error && (
          <div className={styles.error}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>
            {error}
          </div>
        )}

        {/* ===== STEP 1 ===== */}
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
                  <button className={styles.eyeBtn} type="button" tabIndex={-1}
                    onClick={() => setShowPass(v => !v)}>
                    {showPass ? '🙈' : '👁'}
                  </button>
                </div>
              </Field>

              <Field label="Подтверждение пароля">
                <input className={styles.input} type={showPass ? 'text' : 'password'}
                  placeholder="Повторите пароль" value={form1.passwordConfirmation}
                  autoComplete="new-password" onChange={set1('passwordConfirmation')}
                  onKeyDown={e => e.key === 'Enter' && handleStep1()} />
              </Field>

              <Field label="Тип контакта">
                {contactsLoading
                  ? <div className={regStyles.loadingSelect}>Загрузка...</div>
                  : (
                    <select className={styles.select}
                      value={form1.contactTypeId} onChange={set1('contactTypeId')}>
                      {contactTypes.map(ct => (
                        <option key={ct.id} value={ct.id}>
                          {ct.name || ct.localizedName || ct.namePath}
                        </option>
                      ))}
                    </select>
                  )}
              </Field>

              <Field label={selectedContactType?.name || selectedContactType?.localizedName || 'Контакт'}>
                <input
                  className={`${styles.input} ${contactError ? styles.inputError : ''}`}
                  placeholder={getContactPlaceholder(selectedContactType)}
                  value={form1.contactValue}
                  onChange={handleContactChange}
                  onBlur={handleContactBlur}
                  onKeyDown={e => e.key === 'Enter' && handleStep1()}
                  inputMode={getMaskInputMode(selectedContactType?.mask ?? null)}
                  autoComplete="off"
                />
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
            </div>

            <button className={styles.submitBtn} style={{ marginTop: 4 }} onClick={handleStep1} disabled={loading}>
              {loading ? <span className={styles.spinner} /> : 'Далее →'}
            </button>

            <div className={styles.switchRow}>
              Уже есть аккаунт?
              <button className={styles.switchLink} onClick={() => navigate('/login')}>Войти</button>
            </div>
          </>
        )}

        {/* ===== STEP 2 ===== */}
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
                <select className={styles.select}
                  value={form2.gender} onChange={set2('gender')}>
                  <option value="">Не указывать</option>
                  <option value="Male">Мужской</option>
                  <option value="Female">Женский</option>
                </select>
              </Field>
              <Field label="Дата рождения">
                <DatePicker
                  value={form2.birthDate}
                  onChange={iso => setForm2(f => ({ ...f, birthDate: iso }))}
                  placeholder="Выберите дату рождения"
                  min="1900-01-01"
                  max={new Date().toISOString().slice(0, 10)}
                />
              </Field>
            </div>

            <button className={styles.submitBtn}
              onClick={() => finishRegistration(form2)} disabled={loading}>
              {loading ? <span className={styles.spinner} /> : 'Сохранить и войти'}
            </button>

            <button className={regStyles.skipBtn}
              onClick={() => finishRegistration()} disabled={loading}>
              Заполнить позже
            </button>
          </>
        )}
      </div>
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
