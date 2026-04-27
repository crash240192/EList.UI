// pages/settings/SettingsPage.tsx

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchContactTypes } from '@/features/auth/registrationApi';
import type { IContactType } from '@/features/auth/registrationApi';
import {
  changePassword, updateLocation,
  savePersonInfo, getMyPersonInfo,
  createContact, updateContact, getMyContacts,
} from '@/entities/user/settingsApi';
import { useUserLocation } from '@/features/auth/useUserLocation';
import { POPULAR_CITIES, useGeoCity, type ICity } from '@/features/auth/useGeoCity';
import { cookies } from '@/shared/lib/cookies';
import { AvatarUpload } from '@/shared/ui/AvatarUpload/AvatarUpload';
import { CitySearch } from '@/shared/ui/CitySearch/CitySearch';
import { getStoredAccountId } from '@/entities/user/api';
import { Select } from '@/shared/ui/Select/Select';
import { useMyAvatar } from '@/features/auth/useAvatar';
import styles from './SettingsPage.module.css';

type Tab = 'profile' | 'security';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>⚙️ Настройки</h1>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'profile'  ? styles.tabActive : ''}`}
          onClick={() => setTab('profile')}>Профиль</button>
        <button className={`${styles.tab} ${tab === 'security' ? styles.tabActive : ''}`}
          onClick={() => setTab('security')}>Безопасность</button>
      </div>

      <div className={styles.content}>
        {tab === 'profile'  && <ProfileTab />}
        {tab === 'security' && <SecurityTab />}
      </div>
    </div>
  );
}

// =============================================================================
// Вкладка: Профиль
// =============================================================================

function ProfileTab() {
  return (
    <div className={styles.sections}>
      <PersonSection />
      <CitySection />
      <ContactsSection />
    </div>
  );
}

// ---- Персональные данные ----

function PersonSection() {
  const [form, setForm] = useState({
    firstName: '', lastName: '', patronymic: '',
    gender: '' as 'Male' | 'Female' | '',
    birthDate: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null);

  const initials  = (form.firstName?.[0] ?? '') + (form.lastName?.[0] ?? '');
  const accountId = getStoredAccountId() ?? '';
  const { fileId: myAvatarFileId, refresh: refreshAvatar } = useMyAvatar();

  useEffect(() => {
    getMyPersonInfo().then(p => {
      if (p) setForm({
        firstName:  p.firstName  ?? '',
        lastName:   p.lastName   ?? '',
        patronymic: p.patronymic ?? '',
        gender:     (p.gender as any) ?? '',
        birthDate:  p.birthDate ? p.birthDate.slice(0, 10) : '',
      });
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      await savePersonInfo({
        firstName:  form.firstName  || undefined,
        lastName:   form.lastName   || undefined,
        patronymic: form.patronymic || undefined,
        gender:     form.gender     || undefined,
        birthDate:  form.birthDate  ? new Date(form.birthDate).toISOString() : undefined,
      });
      setMsg({ text: 'Сохранено', ok: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Ошибка', ok: false });
    } finally { setSaving(false); }
  };

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <SectionCard title="Личная информация" loading={loading}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <AvatarUpload
          initials={initials || accountId.slice(0, 2).toUpperCase() || '?'}
          accountId={accountId}
          fileId={myAvatarFileId}
          size={80}
          onChanged={() => refreshAvatar()}
        />
      </div>
      <Row label="Имя">
        <input className={styles.input} value={form.firstName}
          onChange={set('firstName')} placeholder="Имя" 
                  onFocus={e => (e.target as HTMLInputElement).select()} />
      </Row>
      <Row label="Фамилия">
        <input className={styles.input} value={form.lastName}
          onChange={set('lastName')} placeholder="Фамилия" 
                  onFocus={e => (e.target as HTMLInputElement).select()} />
      </Row>
      <Row label="Отчество">
        <input className={styles.input} value={form.patronymic}
          onChange={set('patronymic')} placeholder="Отчество" 
                  onFocus={e => (e.target as HTMLInputElement).select()} />
      </Row>
      <Row label="Пол">
        <Select value={form.gender} onChange={v => setForm(f => ({ ...f, gender: v as '' | 'Male' | 'Female' }))}
          placeholder="Не указан"
          options={[{ value: 'Male', label: 'Мужской' }, { value: 'Female', label: 'Женский' }]}
        />
      </Row>
      <Row label="Дата рождения">
        <input className={styles.input} type="date" value={form.birthDate}
          onChange={set('birthDate')} 
                  onFocus={e => (e.target as HTMLInputElement).select()} />
      </Row>
      <SaveRow msg={msg} saving={saving} onSave={handleSave} />
    </SectionCard>
  );
}

// ---- Город ----

function CitySection() {
  const { coords, confirmCity: applyNewCity } = useUserLocation();
  const { detectedCity, loading: geoLoading } = useGeoCity();
  const [selectedCity, setSelectedCity] = useState<ICity | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [msg,          setMsg]          = useState<{ text: string; ok: boolean } | null>(null);

  // Определяем текущий город по coords из POPULAR_CITIES или геокодером
  useEffect(() => {
    let nearest: ICity | null = null;
    let minDist = Infinity;
    for (const city of POPULAR_CITIES) {
      const d = Math.hypot(city.lat - coords.lat, city.lng - coords.lng);
      if (d < minDist) { minDist = d; nearest = city; }
    }
    if (nearest && minDist < 3) setSelectedCity(nearest);
  }, [coords]);

  const handleAutoDetect = () => {
    if (detectedCity) {
      setSelectedCity(detectedCity);
    } else if (!geoLoading && navigator.geolocation) {
      // Геолокация ещё не определена — запрашиваем вручную
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude, longitude } = pos.coords;
        // useGeoCity уже должен был это сделать — просто обновляем координаты
        import('@/features/auth/useGeoCity').then(({ POPULAR_CITIES }) => {
          const nearest = POPULAR_CITIES.reduce((best, city) => {
            const d = Math.hypot(city.lat - latitude, city.lng - longitude);
            return d < Math.hypot(best.lat - latitude, best.lng - longitude) ? city : best;
          });
          setSelectedCity(nearest);
        });
      });
    }
  };

  const handleSave = async () => {
    if (!selectedCity) return;
    setSaving(true); setMsg(null);
    try {
      await updateLocation(selectedCity.lat, selectedCity.lng);
      cookies.set('elist_user_lat', String(selectedCity.lat), 30);
      cookies.set('elist_user_lng', String(selectedCity.lng), 30);
      cookies.set('elist_acct_lat', String(selectedCity.lat), 30);
      cookies.set('elist_acct_lng', String(selectedCity.lng), 30);
      cookies.set('elist_city_decided', '1', 30);
      // Синхронизируем название города для FilterBar
      const displayName = selectedCity.shortName ?? selectedCity.name;
      cookies.set('elist_city_name', displayName, 30);
      setMsg({ text: `Город изменён на ${selectedCity.name}`, ok: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Ошибка', ok: false });
    } finally { setSaving(false); }
  };

  return (
    <SectionCard title="Местоположение">
      <Row label="Сменить город">
        <CitySearch
          value={selectedCity?.name ?? ''}
          onSelect={setSelectedCity}
          geoLoading={geoLoading}
          detectedCoords={coords}
          onAutoDetect={handleAutoDetect}
        />
      </Row>
      <SaveRow msg={msg} saving={saving} onSave={handleSave}
        label="Сохранить город" disabled={!selectedCity} />
    </SectionCard>
  );
}

// ---- Контакты ----

function ContactsSection() {
  const [contacts,      setContacts]      = useState<any[]>([]);
  const [contactTypes,  setContactTypes]  = useState<IContactType[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [addingNew,     setAddingNew]     = useState(false);
  const [msg,           setMsg]           = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const [c, t] = await Promise.all([getMyContacts(), fetchContactTypes()]);
    setContacts(c); setContactTypes(t);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SectionCard title="Контакты" loading={loading}>
      {msg && (
        <div className={`${styles.msg} ${msg.ok ? styles.msgOk : styles.msgErr}`}>
          {msg.text}
        </div>
      )}
      {contacts.map(c => (
        editingId === c.id
          ? <ContactForm key={c.id}
              types={contactTypes}
              initial={c}
              onSave={async data => {
                await updateContact(c.id, data);
                setEditingId(null);
                setMsg({ text: 'Контакт обновлён', ok: true });
                load();
              }}
              onCancel={() => setEditingId(null)} />
          : <ContactRow key={c.id} contact={c}
              onEdit={() => { setEditingId(c.id); setAddingNew(false); }} />
      ))}
      {addingNew
        ? <ContactForm types={contactTypes}
            onSave={async data => {
              await createContact(data);
              setAddingNew(false);
              setMsg({ text: 'Контакт добавлен', ok: true });
              load();
            }}
            onCancel={() => setAddingNew(false)} />
        : <button className={styles.addContactBtn}
            onClick={() => { setAddingNew(true); setEditingId(null); }}>
            + Добавить контакт
          </button>
      }
    </SectionCard>
  );
}

function ContactRow({ contact, onEdit }: { contact: any; onEdit: () => void }) {
  const typeName = contact.contactType?.name
    ?? contact.contactType?.localizedName
    ?? 'Контакт';
  return (
    <div className={styles.contactRow}>
      <div className={styles.contactInfo}>
        <span className={styles.contactType}>{typeName}</span>
        <span className={styles.contactValue}>{contact.value}</span>
      </div>
      <div className={styles.contactMeta}>
        {contact.show
          ? <span className={styles.badge}>публичный</span>
          : <span className={styles.badgeGray}>скрытый</span>}
        {contact.isAuthorizationContact &&
          <span className={styles.badgeAccent}>авторизация</span>}
      </div>
      <button className={styles.editBtn} onClick={onEdit}>✏️</button>
    </div>
  );
}

function ContactForm({ types, initial, onSave, onCancel }: {
  types: IContactType[];
  initial?: any;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    typeId:                 initial?.contactType?.id ?? (types[0]?.id ?? ''),
    value:                  initial?.value ?? '',
    show:                   initial?.show ?? true,
    isAuthorizationContact: initial?.isAuthorizationContact ?? false,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.value.trim()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <div className={styles.contactForm}>
      <Select value={form.typeId} onChange={v => setForm(f => ({ ...f, typeId: v }))}
        options={types.map(t => ({ value: t.id, label: t.name || t.localizedName || '' }))}
      />
      <input className={styles.input} placeholder="Значение"
        value={form.value}
        onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
      <div className={styles.contactFormFlags}>
        <label className={styles.checkLabel}>
          <input type="checkbox" checked={form.show}
            onChange={e => setForm(f => ({ ...f, show: e.target.checked }))} />
          Показывать публично
        </label>
      </div>
      <div className={styles.contactFormActions}>
        <button className={styles.cancelBtnSm} onClick={onCancel}>Отмена</button>
        <button className={styles.saveBtnSm} onClick={handleSave} disabled={saving}>
          {saving ? '...' : initial ? 'Сохранить' : 'Добавить'}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Вкладка: Безопасность
// =============================================================================

function SecurityTab() {
  return (
    <div className={styles.sections}>
      <PasswordSection />
    </div>
  );
}

function PasswordSection() {
  const [form, setForm] = useState({
    oldPassword: '', newPassword: '', newPasswordConfirmation: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState<{ text: string; ok: boolean } | null>(null);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.oldPassword || !form.newPassword) {
      setMsg({ text: 'Заполните все поля', ok: false }); return;
    }
    if (form.newPassword !== form.newPasswordConfirmation) {
      setMsg({ text: 'Пароли не совпадают', ok: false }); return;
    }
    if (form.newPassword.length < 6) {
      setMsg({ text: 'Новый пароль — минимум 6 символов', ok: false }); return;
    }
    setSaving(true); setMsg(null);
    try {
      await changePassword(form);
      setMsg({ text: 'Пароль изменён', ok: true });
      setForm({ oldPassword: '', newPassword: '', newPasswordConfirmation: '' });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Ошибка', ok: false });
    } finally { setSaving(false); }
  };

  return (
    <SectionCard title="Изменить пароль">
      <Row label="Текущий пароль">
        <input className={styles.input} type="password"
          value={form.oldPassword} onChange={set('oldPassword')}
          placeholder="Введите текущий пароль" 
                  onFocus={e => (e.target as HTMLInputElement).select()} />
      </Row>
      <Row label="Новый пароль">
        <input className={styles.input} type="password"
          value={form.newPassword} onChange={set('newPassword')}
          placeholder="Минимум 6 символов" 
                  onFocus={e => (e.target as HTMLInputElement).select()} />
      </Row>
      <Row label="Подтверждение">
        <input className={styles.input} type="password"
          value={form.newPasswordConfirmation} onChange={set('newPasswordConfirmation')}
          placeholder="Повторите новый пароль" 
                  onFocus={e => (e.target as HTMLInputElement).select()} />
      </Row>
      <SaveRow msg={msg} saving={saving} onSave={handleSave} label="Изменить пароль" />
    </SectionCard>
  );
}

// =============================================================================
// Вспомогательные компоненты
// =============================================================================

function SectionCard({ title, children, loading }: {
  title: string; children: React.ReactNode; loading?: boolean;
}) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {loading
        ? <div className={styles.sectionLoader}>Загрузка...</div>
        : children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <label className={styles.rowLabel}>{label}</label>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
}

function SaveRow({ msg, saving, onSave, label = 'Сохранить', disabled = false }: {
  msg:     { text: string; ok: boolean } | null;
  saving:  boolean;
  onSave:  () => void;
  label?:  string;
  disabled?: boolean;
}) {
  return (
    <div className={styles.saveRow}>
      {msg && (
        <span className={msg.ok ? styles.msgOk : styles.msgErr}>{msg.text}</span>
      )}
      <button className={styles.saveBtn} onClick={onSave}
        disabled={saving || disabled}>
        {saving ? 'Сохранение...' : label}
      </button>
    </div>
  );
}
