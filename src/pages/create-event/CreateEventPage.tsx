// pages/create-event/CreateEventPage.tsx

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createEvent, updateEvent, fetchEventById, MOCK_EVENTS } from '@/entities/event';
import styles from './CreateEventPage.module.css';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

interface FormState {
  name: string;
  description: string;
  address: string;
  latitude: string;
  longitude: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  cost: string;
  ageLimit: string;
  isPrivate: boolean;
  maxPersons: string;
  allowUsersToInvite: boolean;
}

const EMPTY_FORM: FormState = {
  name: '', description: '', address: '',
  latitude: '', longitude: '',
  startDate: '', startTime: '', endDate: '', endTime: '',
  cost: '0', ageLimit: '', isPrivate: false, maxPersons: '', allowUsersToInvite: true,
};

export default function CreateEventPage() {
  const navigate  = useNavigate();
  const { id }    = useParams<{ id: string }>();
  const isEditing = !!id;

  const [form, setForm]       = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Если редактирование — загружаем данные
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
        latitude:    String(ev.latitude ?? ''),
        longitude:   String(ev.longitude ?? ''),
        startDate:   ev.startTime ? toDate(ev.startTime) : '',
        startTime:   ev.startTime ? toTime(ev.startTime) : '',
        endDate:     ev.endTime   ? toDate(ev.endTime)   : '',
        endTime:     ev.endTime   ? toTime(ev.endTime)   : '',
        cost:        String(ev.parameters?.cost ?? 0),
        ageLimit:    String(ev.parameters?.ageLimit ?? ''),
        isPrivate:   ev.parameters?.private ?? false,
        maxPersons:  String(ev.parameters?.maxPersonsCount ?? ''),
        allowUsersToInvite: ev.parameters?.allowUsersToInvite ?? true,
      });
    }).finally(() => setLoading(false));
  }, [id, isEditing]);

  const set = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : e.target.value }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Укажите название мероприятия'); return; }
    if (!form.startDate || !form.startTime) { setError('Укажите дату и время начала'); return; }

    setSaving(true);
    setError(null);
    try {
      const startTime = new Date(`${form.startDate}T${form.startTime}`).toISOString();
      const endTime   = form.endDate && form.endTime
        ? new Date(`${form.endDate}T${form.endTime}`).toISOString()
        : undefined;

      const payload = {
        name:        form.name,
        description: form.description || undefined,
        address:     form.address     || undefined,
        latitude:    parseFloat(form.latitude)  || 0,
        longitude:   parseFloat(form.longitude) || 0,
        startTime,
        endTime,
        active: false,
      };

      if (isEditing) {
        await updateEvent(id!, payload);
      } else {
        await createEvent(payload);
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
      {/* ---- Title bar ---- */}
      <div className={styles.titleBar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>←</button>
        <h2 className={styles.title}>{isEditing ? 'Редактировать событие' : 'Создать событие'}</h2>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* ---- Form ---- */}
      <div className={styles.form}>

        {/* Основное */}
        <Section title="Основное">
          <Field label="Название *">
            <input className={styles.input} placeholder="Название мероприятия" value={form.name} onChange={set('name')} />
          </Field>
          <Field label="Описание">
            <textarea className={styles.textarea} rows={4} placeholder="Расскажите о мероприятии..." value={form.description} onChange={set('description')} />
          </Field>
        </Section>

        {/* Место */}
        <Section title="Место">
          <Field label="Адрес">
            <input className={styles.input} placeholder="Адрес или название места" value={form.address} onChange={set('address')} />
          </Field>
          <div className={styles.mapPlaceholder}>
            📍 Здесь будет выбор точки на карте
            <small>Интеграция Leaflet / Яндекс.Карты</small>
          </div>
          <div className={styles.row}>
            <Field label="Широта">
              <input className={styles.input} type="number" placeholder="55.7558" value={form.latitude} onChange={set('latitude')} />
            </Field>
            <Field label="Долгота">
              <input className={styles.input} type="number" placeholder="37.6173" value={form.longitude} onChange={set('longitude')} />
            </Field>
          </div>
        </Section>

        {/* Дата */}
        <Section title="Дата и время">
          <div className={styles.row}>
            <Field label="Дата начала *">
              <input className={styles.input} type="date" value={form.startDate} onChange={set('startDate')} />
            </Field>
            <Field label="Время начала *">
              <input className={styles.input} type="time" value={form.startTime} onChange={set('startTime')} />
            </Field>
          </div>
          <div className={styles.row}>
            <Field label="Дата окончания">
              <input className={styles.input} type="date" value={form.endDate} onChange={set('endDate')} />
            </Field>
            <Field label="Время окончания">
              <input className={styles.input} type="time" value={form.endTime} onChange={set('endTime')} />
            </Field>
          </div>
        </Section>

        {/* Параметры */}
        <Section title="Параметры">
          <Field label="Стоимость (₽, 0 = бесплатно)">
            <input className={styles.input} type="number" min={0} step={50} value={form.cost} onChange={set('cost')} />
          </Field>
          <Field label="Ограничение по возрасту">
            <input className={styles.input} type="number" min={0} max={99} placeholder="Нет ограничений" value={form.ageLimit} onChange={set('ageLimit')} />
          </Field>
          <Field label="Макс. участников">
            <input className={styles.input} type="number" min={1} placeholder="Без ограничений" value={form.maxPersons} onChange={set('maxPersons')} />
          </Field>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={form.isPrivate} onChange={set('isPrivate')} />
            Приватное мероприятие
          </label>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={form.allowUsersToInvite} onChange={set('allowUsersToInvite')} />
            Участники могут приглашать других
          </label>
        </Section>

        {/* Медиа — плейсхолдер */}
        <Section title="Фото">
          <div className={styles.uploadPlaceholder}>
            🖼 Загрузка обложки и фотографий
            <small>Интеграция: POST /api/media/...</small>
          </div>
        </Section>

        {/* Команда — плейсхолдер */}
        <Section title="Организаторы и приглашения">
          <div className={styles.uploadPlaceholder}>
            👥 Добавить соорганизаторов и администраторов
            <br />
            ✉️ Отправить приглашения подписчикам
            <small>Интеграция: POST /api/invitations/create</small>
          </div>
        </Section>

        {/* Danger zone (только при редактировании) */}
        {isEditing && (
          <Section title="Управление">
            <button className={styles.dangerBtn}>❌ Отменить мероприятие</button>
            <button className={styles.dangerBtn}>🏁 Завершить мероприятие</button>
          </Section>
        )}

      </div>

      {/* ---- Footer actions ---- */}
      <div className={styles.footer}>
        <button className={styles.cancelBtn} onClick={() => navigate(-1)}>Отмена</button>
        <button className={styles.submitBtn} onClick={handleSubmit} disabled={saving}>
          {saving ? 'Сохранение...' : isEditing ? 'Сохранить' : 'Создать'}
        </button>
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
