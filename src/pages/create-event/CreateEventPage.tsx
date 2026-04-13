// pages/create-event/CreateEventPage.tsx

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchEventById, fetchEventCategories, fetchEventTypes, MOCK_EVENTS } from '@/entities/event';
import { apiClient } from '@/shared/api/client';
import { getOrFetchAccountId } from '@/entities/user/api';
import { CategoryTypePicker } from '@/features/event-filters/CategoryTypePicker';
import type { IEventCategory, IEventType } from '@/entities/event';
import type { Gender } from '@/shared/api/types';
import styles from './CreateEventPage.module.css';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

interface FormState {
  name: string;
  description: string;
  address: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  cost: string;
  ageLimit: string;
  isPrivate: boolean;
  maxPersons: string;
  allowUsersToInvite: boolean;
  allowedGender: Gender | '';
}

const EMPTY: FormState = {
  name: '', description: '', address: '',
  startDate: '', startTime: '', endDate: '', endTime: '',
  cost: '0', ageLimit: '', isPrivate: false,
  maxPersons: '', allowUsersToInvite: true, allowedGender: '',
};

export default function CreateEventPage() {
  const navigate  = useNavigate();
  const { id }    = useParams<{ id: string }>();
  const isEditing = !!id;

  const [form, setForm]       = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Координаты из карты
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // Выбранные типы мероприятия
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTypes,      setSelectedTypes]      = useState<string[]>([]);
  const [pickerOpen,         setPickerOpen]         = useState(false);
  const typeFilterCount = selectedCategories.length + selectedTypes.length;

  // Загрузка при редактировании
  useEffect(() => {
    if (!isEditing) return;
    setLoading(true);
    const load = USE_MOCK
      ? Promise.resolve(MOCK_EVENTS.find(e => e.id === id) ?? MOCK_EVENTS[0])
      : fetchEventById(id!);
    load.then(ev => {
      const toDate = (iso: string) => iso.slice(0, 10);
      const toTime = (iso: string) => iso.slice(11, 16);
      setForm({
        name:        ev.name ?? '',
        description: ev.description ?? '',
        address:     ev.address ?? '',
        startDate:   ev.startTime ? toDate(ev.startTime) : '',
        startTime:   ev.startTime ? toTime(ev.startTime) : '',
        endDate:     ev.endTime   ? toDate(ev.endTime)   : '',
        endTime:     ev.endTime   ? toTime(ev.endTime)   : '',
        cost:        String(ev.parameters?.cost ?? 0),
        ageLimit:    String(ev.parameters?.ageLimit ?? ''),
        isPrivate:   ev.parameters?.private ?? false,
        maxPersons:  String(ev.parameters?.maxPersonsCount ?? ''),
        allowUsersToInvite: ev.parameters?.allowUsersToInvite ?? true,
        allowedGender: ev.parameters?.allowedGender ?? '',
      });
      if (ev.latitude)  setLat(ev.latitude);
      if (ev.longitude) setLng(ev.longitude);
    }).finally(() => setLoading(false));
  }, [id, isEditing]);

  const set = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.type === 'checkbox'
        ? (e.target as HTMLInputElement).checked : e.target.value }));

  // ---- Submit ----
  const handleSubmit = async () => {
    if (!form.name.trim())             { setError('Укажите название'); return; }
    if (!form.startDate || !form.startTime) { setError('Укажите дату и время начала'); return; }

    setSaving(true);
    setError(null);
    try {
      const accountId = await getOrFetchAccountId();
      const startTime = new Date(`${form.startDate}T${form.startTime}`).toISOString();
      const endTime   = form.endDate && form.endTime
        ? new Date(`${form.endDate}T${form.endTime}`).toISOString()
        : null;

      const payload = {
        event: {
          name:        form.name,
          description: form.description || undefined,
          address:     form.address     || undefined,
          latitude:    lat  ?? 0,
          longitude:   lng  ?? 0,
          startTime,
          endTime,
          active: false,
        },
        eventParameters: {
          cost:               parseFloat(form.cost) || 0,
          private:            form.isPrivate,
          maxPersonsCount:    form.maxPersons ? parseInt(form.maxPersons) : undefined,
          ageLimit:           form.ageLimit   ? parseInt(form.ageLimit)   : undefined,
          allowedGender:      form.allowedGender || undefined,
          allowUsersToInvite: form.allowUsersToInvite,
        },
        // Передаём выбранные типы (и типы из выбранных категорий тоже можно)
        eventTypes: selectedTypes,
        organizatorAccountIds: [accountId],
        organizatorOrganizationIds: null,
      };

      if (isEditing) {
        await apiClient.put(`/api/events/update/${id}`, payload);
      } else {
        await apiClient.post('/api/events/create', payload);
      }

      navigate('/my-events');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className={styles.page}>
      <div className={styles.skeletonBlock} style={{ height: 40, width: '50%' }} />
      <div className={styles.skeletonBlock} style={{ height: 200 }} />
    </div>
  );

  return (
    <div className={styles.page}>
      {/* Title bar */}
      <div className={styles.titleBar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>←</button>
        <h2 className={styles.title}>{isEditing ? 'Редактировать событие' : 'Создать событие'}</h2>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.form}>

        {/* Основное */}
        <Section title="Основное">
          <Field label="Название *">
            <input className={styles.input} placeholder="Название мероприятия"
              value={form.name} onChange={set('name')} />
          </Field>
          <Field label="Описание">
            <textarea className={styles.textarea} rows={4}
              placeholder="Расскажите о мероприятии..." value={form.description}
              onChange={set('description')} />
          </Field>
        </Section>

        {/* Тип мероприятия */}
        <Section title="Тип мероприятия">
          <button
            className={`${styles.pickerBtn} ${typeFilterCount > 0 ? styles.pickerBtnActive : ''}`}
            onClick={() => setPickerOpen(true)}
            type="button"
          >
            <span>🎭</span>
            {typeFilterCount > 0
              ? `Выбрано типов: ${typeFilterCount}`
              : 'Выбрать категорию и тип...'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </Section>

        {/* Место */}
        <Section title="Место">
          <Field label="Адрес">
            <input className={styles.input} placeholder="Введите адрес"
              value={form.address} onChange={set('address')} />
          </Field>

          {/* OSM карта с кликом для выбора координат */}
          <OsmPicker lat={lat} lng={lng} onPick={(la, lo) => { setLat(la); setLng(lo); }} />

          {(lat !== null && lng !== null) && (
            <p className={styles.coordHint}>
              📍 Выбрано: {lat.toFixed(5)}, {lng.toFixed(5)}
              <button className={styles.coordClear}
                onClick={() => { setLat(null); setLng(null); }}>
                ✕
              </button>
            </p>
          )}
        </Section>

        {/* Дата и время */}
        <Section title="Дата и время">
          <div className={styles.row}>
            <Field label="Дата начала *">
              <input className={styles.input} type="date"
                value={form.startDate} onChange={set('startDate')} />
            </Field>
            <Field label="Время начала *">
              <input className={styles.input} type="time"
                value={form.startTime} onChange={set('startTime')} />
            </Field>
          </div>
          <div className={styles.row}>
            <Field label="Дата окончания">
              <input className={styles.input} type="date"
                value={form.endDate} onChange={set('endDate')} />
            </Field>
            <Field label="Время окончания">
              <input className={styles.input} type="time"
                value={form.endTime} onChange={set('endTime')} />
            </Field>
          </div>
        </Section>

        {/* Параметры */}
        <Section title="Параметры">
          <Field label="Стоимость (₽, 0 = бесплатно)">
            <input className={styles.input} type="number" min={0} step={50}
              value={form.cost} onChange={set('cost')} />
          </Field>
          <div className={styles.row}>
            <Field label="Ограничение по возрасту">
              <input className={styles.input} type="number" min={0} max={99}
                placeholder="Нет" value={form.ageLimit} onChange={set('ageLimit')} />
            </Field>
            <Field label="Макс. участников">
              <input className={styles.input} type="number" min={1}
                placeholder="∞" value={form.maxPersons} onChange={set('maxPersons')} />
            </Field>
          </div>
          <Field label="Ограничение по полу">
            <select className={styles.input} value={form.allowedGender}
              onChange={set('allowedGender')}>
              <option value="">Без ограничений</option>
              <option value="Male">Мужской</option>
              <option value="Female">Женский</option>
            </select>
          </Field>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={form.isPrivate} onChange={set('isPrivate')} />
            Приватное мероприятие
          </label>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={form.allowUsersToInvite}
              onChange={set('allowUsersToInvite')} />
            Участники могут приглашать других
          </label>
        </Section>

        {/* Фото — плейсхолдер */}
        <Section title="Фото">
          <div className={styles.uploadPlaceholder}>
            🖼 Загрузка обложки и фотографий
            <small>Интеграция: POST /api/media/...</small>
          </div>
        </Section>

        {/* Управление (редактирование) */}
        {isEditing && (
          <Section title="Управление">
            <button className={styles.dangerBtn}>❌ Отменить мероприятие</button>
            <button className={styles.dangerBtn}>🏁 Завершить мероприятие</button>
          </Section>
        )}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <button className={styles.cancelBtn} onClick={() => navigate(-1)}>Отмена</button>
        <button className={styles.submitBtn} onClick={handleSubmit} disabled={saving}>
          {saving ? 'Сохранение...' : isEditing ? 'Сохранить' : 'Создать'}
        </button>
      </div>

      {/* Category picker modal */}
      {pickerOpen && (
        <CategoryTypePicker
          selectedCategories={selectedCategories}
          selectedTypes={selectedTypes}
          onChange={(cats, types) => {
            setSelectedCategories(cats);
            setSelectedTypes(types);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

// ---- OSM Picker ----
// iframe с OpenStreetMap + postMessage для передачи координат по клику.
// Работает без API-ключей и без react-leaflet.

function OsmPicker({
  lat, lng, onPick,
}: { lat: number | null; lng: number | null; onPick: (lat: number, lng: number) => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Слушаем сообщения от iframe (если карта поддерживает postMessage)
  // Для OpenStreetMap embed прямого postMessage нет, поэтому используем
  // простой fallback: показываем iframe для визуализации и отдельную кнопку
  // для ручного ввода через prompt. Полноценная интеграция — через leaflet.

  const defaultLat = lat ?? 55.7558;
  const defaultLng = lng ?? 37.6173;

  const bbox  = `${defaultLng-0.05},${defaultLat-0.03},${defaultLng+0.05},${defaultLat+0.03}`;
  const marker = lat && lng ? `&marker=${lat},${lng}` : '';
  const src   = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik${marker}`;

  const handlePickManual = () => {
    // Пока leaflet не интегрирован — принимаем координаты через prompt
    const input = window.prompt(
      'Введите координаты через запятую (широта, долгота):\nПример: 55.7558, 37.6173'
    );
    if (!input) return;
    const parts = input.split(',').map(s => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      onPick(parts[0], parts[1]);
    }
  };

  return (
    <div className={styles.mapContainer}>
      <iframe
        ref={iframeRef}
        className={styles.mapFrame}
        src={src}
        title="Карта"
        loading="lazy"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin"
      />
      <div className={styles.mapOverlay}>
        <button className={styles.mapPickBtn} type="button" onClick={handlePickManual}>
          📍 Указать точку вручную
        </button>
        <span className={styles.mapHint}>
          Для интерактивного выбора добавьте react-leaflet
        </span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
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
