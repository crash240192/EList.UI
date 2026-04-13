// pages/auth/RegisterPage.tsx
// Двухшаговая регистрация:
//   Шаг 1 — логин, пароль, тип и значение контакта → createAccount
//   Шаг 2 — ФИО, пол, дата рождения (необязательно, можно скипнуть)
//   Финал — автоматический логин → setPersonInfo (если не скипнули) → /activate или /

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchContactTypes,
  createAccount,
  setPersonInfo,
  type IContactType,
} from '@/features/auth/registrationApi';
import { login } from '@/features/auth/api';
import { useAuthStore } from '@/app/store';
import { useGeoCity, POPULAR_CITIES, type ICity } from '@/features/auth/useGeoCity';
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
  const [selectedCity, setSelectedCity] = useState<ICity | null>(null);

  // Когда геолокация определилась — подставляем найденный город
  useEffect(() => {
    if (detectedCity && !selectedCity) setSelectedCity(detectedCity);
  }, [detectedCity]);

  // Итоговые координаты: сначала точные (GPS/IP), потом из выбранного города
  const finalCoords = detectedCoords ?? (selectedCity
    ? { lat: selectedCity.lat, lng: selectedCity.lng }
    : null);

  const [form1, setForm1] = useState<Step1Form>({
    login: '', password: '', passwordConfirmation: '',
    contactTypeId: '', contactValue: '',
  });

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
    if (!form1.contactValue.trim()) return 'Введите контактные данные';
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
        // Координаты: точные из геолокации или из выбранного города
        latitude:  finalCoords?.lat ?? undefined,
        longitude: finalCoords?.lng ?? undefined,
      });
      setSavedCreds({ login: form1.login.trim(), password: form1.password });
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка при регистрации');
    } finally {
      setLoading(false);
    }
  };

  // ---- Финальный логин после шага 2 (с персданными или без) ----
  const finishRegistration = async (personData?: Step2Form) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Авторизуемся
      const authResult = await login(savedCreds);
      setAuth(authResult.token, authResult.activationRequired);

      // 2. Сохраняем персданные сразу — токен уже есть, эндпоинт POST /api/persons/set
      if (personData) {
        const hasData = personData.firstName || personData.lastName ||
                        personData.patronymic || personData.gender || personData.birthDate;
        if (hasData) {
          await setPersonInfo({
            firstName:  personData.firstName.trim()  || undefined,
            lastName:   personData.lastName.trim()   || undefined,
            patronymic: personData.patronymic.trim() || undefined,
            gender:     personData.gender            || undefined,
            birthDate:  personData.birthDate
              ? new Date(personData.birthDate).toISOString()
              : undefined,
          }).catch(() => { /* не критично — профиль можно заполнить позже */ });
        }
      }

      // 3. Если нужна активация — переходим на страницу кода
      if (authResult.activationRequired) {
        navigate('/activate', { replace: true });
        return;
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
      <div className={`${styles.card} ${regStyles.card}`}>
        {/* Logo */}
        <div className={styles.logo}>
          <span className={styles.logoIcon}>📍</span>
          <span className={styles.logoText}>EList</span>
        </div>

        {/* Step indicator */}
        <div className={regStyles.stepRow}>
          <div className={`${regStyles.stepDot} ${step >= 1 ? regStyles.stepDotActive : ''}`}>1</div>
          <div className={`${regStyles.stepLine} ${step >= 2 ? regStyles.stepLineActive : ''}`} />
          <div className={`${regStyles.stepDot} ${step >= 2 ? regStyles.stepDotActive : ''}`}>2</div>
        </div>

        <p className={styles.subtitle}>
          {step === 1 ? 'Создайте аккаунт' : 'Расскажите о себе'}
        </p>

        {error && <div className={styles.error}>{error}</div>}

        {/* ===== STEP 1 ===== */}
        {step === 1 && (
          <>
            <div className={styles.fields}>
              <Field label="Логин">
                <input className={styles.input} placeholder="Придумайте логин"
                  value={form1.login} autoFocus autoComplete="username"
                  onChange={set1('login')} onKeyDown={e => e.key === 'Enter' && handleStep1()} />
              </Field>

              <Field label="Пароль">
                <div className={styles.passWrap}>
                  <input className={styles.input} type={showPass ? 'text' : 'password'}
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
                    <select className={`${styles.input} ${regStyles.select}`}
                      value={form1.contactTypeId} onChange={set1('contactTypeId')}>
                      {contactTypes.map(ct => (
                        <option key={ct.id} value={ct.id}>
                          {ct.localizedName ?? ct.namePath}
                        </option>
                      ))}
                    </select>
                  )}
              </Field>

              <Field label={selectedContactType?.localizedName ?? 'Контакт'}>
                <input className={styles.input}
                  placeholder={selectedContactType?.mask ?? 'Введите контакт'}
                  value={form1.contactValue} onChange={set1('contactValue')}
                  onKeyDown={e => e.key === 'Enter' && handleStep1()} />
                {selectedContactType?.description && (
                  <p className={regStyles.fieldHint}>{selectedContactType.description}</p>
                )}
              </Field>

              {/* Город */}
              <Field label="Ваш город">
                <div className={regStyles.cityRow}>
                  <select
                    className={`${styles.input} ${regStyles.select}`}
                    value={selectedCity?.name ?? ''}
                    onChange={e => {
                      const city = POPULAR_CITIES.find(c => c.name === e.target.value) ?? null;
                      setSelectedCity(city);
                    }}
                  >
                    <option value="">— Выбрать город —</option>
                    {POPULAR_CITIES.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  {geoLoading && <span className={regStyles.geoSpinner} title="Определяем местоположение...">📡</span>}
                  {!geoLoading && detectedCoords && (
                    <span className={regStyles.geoOk} title="Координаты определены точно">✓</span>
                  )}
                </div>
                {detectedCoords && (
                  <p className={regStyles.fieldHint}>
                    📍 Координаты определены ({detectedCoords.lat.toFixed(3)}, {detectedCoords.lng.toFixed(3)})
                  </p>
                )}
              </Field>
            </div>

            <button className={styles.submitBtn} onClick={handleStep1} disabled={loading}>
              {loading ? <span className={styles.spinner} /> : 'Далее →'}
            </button>

            <p className={styles.hint}>
              Уже есть аккаунт?{' '}
              <button className={styles.linkBtn} onClick={() => navigate('/login')}>Войти</button>
            </p>
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
                <select className={`${styles.input} ${regStyles.select}`}
                  value={form2.gender} onChange={set2('gender')}>
                  <option value="">Не указывать</option>
                  <option value="Male">Мужской</option>
                  <option value="Female">Женский</option>
                </select>
              </Field>
              <Field label="Дата рождения">
                <input className={styles.input} type="date"
                  value={form2.birthDate} onChange={set2('birthDate')} />
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
