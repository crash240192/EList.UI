// pages/settings/SettingsPage.tsx — макет examples/elist_settings_wallet.html

import { useState, useEffect, useCallback, type ReactNode } from 'react';
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
import { DatePicker } from '@/shared/ui/DatePicker/DatePicker';
import { useMyAvatar } from '@/features/auth/useAvatar';
import { useFiltersStore } from '@/app/store';
import { SettingsWalletNav } from '@/features/settings/SettingsWalletNav';
import styles from './SettingsPage.module.css';

type SettingsTab = 'profile' | 'contacts' | 'location' | 'security';

const NAV_ITEMS: { key: SettingsTab; label: string; section: string; icon: ReactNode }[] = [
  {
    key: 'profile',
    section: 'Аккаунт',
    label: 'Личные данные',
    icon: (
      <svg className={styles.snavIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    key: 'contacts',
    section: 'Аккаунт',
    label: 'Контакты',
    icon: (
      <svg className={styles.snavIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
  },
  {
    key: 'location',
    section: 'Аккаунт',
    label: 'Местоположение',
    icon: (
      <svg className={styles.snavIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    key: 'security',
    section: 'Безопасность',
    label: 'Пароль',
    icon: (
      <svg className={styles.snavIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('profile');
  const sections = [...new Set(NAV_ITEMS.map(i => i.section))];

  return (
    <div className={styles.page}>
      <SettingsWalletNav />
      <div className={styles.settingsLayout}>
        <nav className={styles.snav}>
          {sections.map(section => (
            <div key={section}>
              <div className={styles.snavSection}>{section}</div>
              {NAV_ITEMS.filter(i => i.section === section).map(item => (
                <button
                  key={item.key}
                  type="button"
                  className={`${styles.snavItem} ${tab === item.key ? styles.snavItemActive : ''}`}
                  onClick={() => setTab(item.key)}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.scontent}>
          <div className={`${styles.stab} ${tab === 'profile' ? styles.stabActive : ''}`}>
            <ProfileTab />
          </div>
          <div className={`${styles.stab} ${tab === 'contacts' ? styles.stabActive : ''}`}>
            <ContactsSection />
          </div>
          <div className={`${styles.stab} ${tab === 'location' ? styles.stabActive : ''}`}>
            <CitySection />
          </div>
          <div className={`${styles.stab} ${tab === 'security' ? styles.stabActive : ''}`}>
            <PasswordSection />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileTab() {
  const [form, setForm] = useState({
    firstName: '', lastName: '', patronymic: '',
    gender: '' as 'Male' | 'Female' | '',
    birthDate: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const initials = (form.firstName?.[0] ?? '') + (form.lastName?.[0] ?? '');
  const accountId = getStoredAccountId() ?? '';
  const { fileId: myAvatarFileId, refresh: refreshAvatar } = useMyAvatar();
  const displayName = [form.firstName, form.lastName].filter(Boolean).join(' ') || 'Профиль';

  useEffect(() => {
    getMyPersonInfo().then(p => {
      if (p) setForm({
        firstName: p.firstName ?? '',
        lastName: p.lastName ?? '',
        patronymic: p.patronymic ?? '',
        gender: (p.gender as 'Male' | 'Female' | '') ?? '',
        birthDate: p.birthDate ? p.birthDate.slice(0, 10) : '',
      });
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await savePersonInfo({
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        patronymic: form.patronymic || undefined,
        gender: form.gender || undefined,
        birthDate: form.birthDate ? new Date(form.birthDate).toISOString() : undefined,
      });
      setMsg({ text: '✓ Изменения сохранены', ok: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Ошибка', ok: false });
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  if (loading) {
    return <div className={styles.sectionLoader}>Загрузка...</div>;
  }

  return (
    <>
      <div className={styles.scard}>
        <div className={styles.scardHead}>
          <div className={styles.scardTitle}>Фото профиля</div>
          <div className={styles.scardDesc}>Видна всем пользователям</div>
        </div>
        <div className={styles.avatarSection}>
          <AvatarUpload
            initials={initials || accountId.slice(0, 2).toUpperCase() || '?'}
            accountId={accountId}
            fileId={myAvatarFileId}
            size={72}
            onChanged={() => refreshAvatar()}
          />
          <div className={styles.avInfo}>
            <h4>{displayName}</h4>
            <p>JPG, PNG или GIF · до 5 МБ<br />Нажмите на аватар, чтобы загрузить фото</p>
          </div>
        </div>
      </div>

      <div className={styles.scard}>
        <div className={styles.scardHead}>
          <div className={styles.scardTitle}>Личная информация</div>
        </div>
        <div className={`${styles.scardBody} ${styles.scardBodyPad0}`}>
          <div className={styles.frow}>
            <label className={styles.frowLabel}>Имя</label>
            <div className={styles.frowControl}>
              <input className={styles.input} value={form.firstName} onChange={set('firstName')} placeholder="Имя"
                onFocus={e => e.target.select()} />
            </div>
          </div>
          <div className={styles.frow}>
            <label className={styles.frowLabel}>Фамилия</label>
            <div className={styles.frowControl}>
              <input className={styles.input} value={form.lastName} onChange={set('lastName')} placeholder="Фамилия"
                onFocus={e => e.target.select()} />
            </div>
          </div>
          <div className={styles.frow}>
            <label className={styles.frowLabel}>Отчество</label>
            <div className={styles.frowControl}>
              <input className={styles.input} value={form.patronymic} onChange={set('patronymic')} placeholder="Отчество (необязательно)"
                onFocus={e => e.target.select()} />
            </div>
          </div>
          <div className={styles.frow}>
            <label className={styles.frowLabel}>Пол</label>
            <div className={styles.frowControl}>
              <Select value={form.gender} onChange={v => setForm(f => ({ ...f, gender: v as '' | 'Male' | 'Female' }))}
                placeholder="Не указан"
                options={[{ value: 'Male', label: 'Мужской' }, { value: 'Female', label: 'Женский' }]} />
            </div>
          </div>
          <div className={styles.frow}>
            <label className={styles.frowLabel}>Дата рождения</label>
            <div className={styles.frowControl}>
              <DatePicker
                value={form.birthDate}
                onChange={iso => setForm(f => ({ ...f, birthDate: iso }))}
                placeholder="дд.мм.гггг"
                min="1900-01-01"
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>
        </div>
        <div className={styles.scardFooter}>
          {msg && <span className={msg.ok ? styles.msgOk : styles.msgErr}>{msg.text}</span>}
          {!msg && <span />}
          <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </>
  );
}

function CitySection() {
  const { coords } = useUserLocation();
  const { detectedCity, loading: geoLoading } = useGeoCity();
  const [selectedCity, setSelectedCity] = useState<ICity | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

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
    const source = detectedCity
      ? { lat: detectedCity.lat, lng: detectedCity.lng }
      : coords;

    let nearest: ICity | null = null;
    let minDist = Infinity;
    for (const city of POPULAR_CITIES) {
      const d = Math.hypot(city.lat - source.lat, city.lng - source.lng);
      if (d < minDist) { minDist = d; nearest = city; }
    }
    if (nearest) setSelectedCity(nearest);
  };

  const handleSave = async () => {
    if (!selectedCity) return;
    setSaving(true);
    setMsg(null);
    try {
      await updateLocation(selectedCity.lat, selectedCity.lng);
      cookies.set('elist_user_lat', String(selectedCity.lat), 30);
      cookies.set('elist_user_lng', String(selectedCity.lng), 30);
      cookies.set('elist_acct_lat', String(selectedCity.lat), 30);
      cookies.set('elist_acct_lng', String(selectedCity.lng), 30);
      cookies.delete('elist_city_decided');
      const displayName = selectedCity.shortName ?? selectedCity.name;
      cookies.set('elist_home_city_name', displayName, 30);
      cookies.set('elist_city_name', displayName, 30);
      window.dispatchEvent(new CustomEvent('elist:homeCityChanged', {
        detail: { lat: selectedCity.lat, lng: selectedCity.lng, name: displayName },
      }));
      const store = useFiltersStore.getState();
      store.setMapCenter([selectedCity.lat, selectedCity.lng]);
      store.setMapZoom(12);
      store.setFilter('latitude', selectedCity.lat);
      store.setFilter('longitude', selectedCity.lng);
      cookies.set('elist_city_decided', '1', 30);
      setMsg({ text: `✓ Город изменён на ${selectedCity.name}`, ok: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Ошибка', ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.scard}>
      <div className={styles.scardHead}>
        <div className={styles.scardTitle}>Текущий город</div>
        <div className={styles.scardDesc}>Используется для поиска событий поблизости</div>
      </div>
      {selectedCity && (
        <div className={styles.cityBlock}>
          <div className={styles.cityEmoji}>📍</div>
          <div>
            <div className={styles.cityName}>{selectedCity.name}</div>
            <div className={styles.citySub}>
              {selectedCity.lat.toFixed(4)}° N, {selectedCity.lng.toFixed(4)}° E
            </div>
          </div>
        </div>
      )}
      <div className={styles.scardBody}>
        <CitySearch
          value={selectedCity?.name ?? ''}
          onSelect={setSelectedCity}
          geoLoading={geoLoading}
          detectedCoords={coords}
          onAutoDetect={handleAutoDetect}
        />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          Или введите название города вручную
        </div>
      </div>
      <div className={styles.scardFooter}>
        {msg && <span className={msg.ok ? styles.msgOk : styles.msgErr}>{msg.text}</span>}
        {!msg && <span />}
        <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving || !selectedCity}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

function ContactsSection() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactTypes, setContactTypes] = useState<IContactType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const [c, t] = await Promise.all([getMyContacts(), fetchContactTypes()]);
    setContacts(c);
    setContactTypes(t);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className={styles.sectionLoader}>Загрузка...</div>;
  }

  return (
    <div className={styles.scard}>
      <div className={styles.scardHead}>
        <div className={styles.scardTitle}>Контактные данные</div>
        <div className={styles.scardDesc}>Публичные контакты видны другим пользователям</div>
      </div>
      {msg && (
        <div className={`${styles.msg} ${msg.ok ? styles.msgBoxOk : styles.msgBoxErr}`} style={{ margin: '12px 18px 0' }}>
          {msg.text}
        </div>
      )}
      <div className={`${styles.scardBody} ${styles.scardBodyPad0}`}>
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
        {addingNew && (
          <ContactForm types={contactTypes}
            onSave={async data => {
              await createContact(data);
              setAddingNew(false);
              setMsg({ text: 'Контакт добавлен', ok: true });
              load();
            }}
            onCancel={() => setAddingNew(false)} />
        )}
      </div>
      <div className={styles.scardFooter}>
        <button type="button" className={styles.addContactBtn}
          onClick={() => { setAddingNew(true); setEditingId(null); }}>
          + Добавить контакт
        </button>
        <span />
      </div>
    </div>
  );
}

function contactIcon(typeName: string): string {
  const n = typeName.toLowerCase();
  if (n.includes('email') || n.includes('почт')) return '📧';
  if (n.includes('telegram')) return '💬';
  if (n.includes('сайт') || n.includes('site') || n.includes('web')) return '🌐';
  if (n.includes('тел') || n.includes('phone')) return '📱';
  return '🔗';
}

function ContactRow({ contact, onEdit }: { contact: any; onEdit: () => void }) {
  const typeName = contact.contactType?.name
    ?? contact.contactType?.localizedName
    ?? 'Контакт';

  return (
    <div className={styles.contactRow}>
      <div className={styles.creIco}>{contactIcon(typeName)}</div>
      <div className={styles.creInfo}>
        <div className={styles.creType}>{typeName}</div>
        <div className={styles.creVal}>{contact.value}</div>
      </div>
      <div className={styles.creBadges}>
        {contact.show
          ? <span className={`${styles.creBadge} ${styles.crePub}`}>публичный</span>
          : <span className={`${styles.creBadge} ${styles.crePriv}`}>скрытый</span>}
        {contact.isAuthorizationContact &&
          <span className={`${styles.creBadge} ${styles.creAuth}`}>авторизация</span>}
      </div>
      <div className={styles.creActions}>
        <button type="button" className={styles.iconBtn} onClick={onEdit} title="Редактировать">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </div>
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
    typeId: initial?.contactType?.id ?? (types[0]?.id ?? ''),
    value: initial?.value ?? '',
    show: initial?.show ?? true,
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
        options={types.map(t => ({ value: t.id, label: t.name || t.localizedName || '' }))} />
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
        <button type="button" className={styles.cancelBtnSm} onClick={onCancel}>Отмена</button>
        <button type="button" className={styles.saveBtnSm} onClick={handleSave} disabled={saving}>
          {saving ? '...' : initial ? 'Сохранить' : 'Добавить'}
        </button>
      </div>
    </div>
  );
}

function PasswordSection() {
  const [form, setForm] = useState({
    oldPassword: '', newPassword: '', newPasswordConfirmation: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.oldPassword || !form.newPassword) {
      setMsg({ text: 'Заполните все поля', ok: false });
      return;
    }
    if (form.newPassword !== form.newPasswordConfirmation) {
      setMsg({ text: 'Пароли не совпадают', ok: false });
      return;
    }
    if (form.newPassword.length < 6) {
      setMsg({ text: 'Новый пароль — минимум 6 символов', ok: false });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await changePassword(form);
      setMsg({ text: '✓ Пароль изменён', ok: true });
      setForm({ oldPassword: '', newPassword: '', newPasswordConfirmation: '' });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Ошибка', ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.scard}>
      <div className={styles.scardHead}>
        <div className={styles.scardTitle}>Изменить пароль</div>
      </div>
      <div className={`${styles.scardBody} ${styles.scardBodyPad0}`}>
        <div className={styles.frow}>
          <label className={styles.frowLabel}>Текущий пароль</label>
          <div className={styles.frowControl}>
            <input className={styles.input} type="password"
              value={form.oldPassword} onChange={set('oldPassword')}
              placeholder="Введите текущий пароль"
              onFocus={e => e.target.select()} />
          </div>
        </div>
        <div className={styles.frow}>
          <label className={styles.frowLabel}>Новый пароль</label>
          <div className={styles.frowControl}>
            <input className={styles.input} type="password"
              value={form.newPassword} onChange={set('newPassword')}
              placeholder="Минимум 6 символов"
              onFocus={e => e.target.select()} />
          </div>
        </div>
        <div className={styles.frow}>
          <label className={styles.frowLabel}>Подтверждение</label>
          <div className={styles.frowControl}>
            <input className={styles.input} type="password"
              value={form.newPasswordConfirmation} onChange={set('newPasswordConfirmation')}
              placeholder="Повторите новый пароль"
              onFocus={e => e.target.select()} />
          </div>
        </div>
      </div>
      <div className={styles.scardFooter}>
        {msg && <span className={msg.ok ? styles.msgOk : styles.msgErr}>{msg.text}</span>}
        {!msg && <span />}
        <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Сохранение...' : 'Изменить пароль'}
        </button>
      </div>
    </div>
  );
}
