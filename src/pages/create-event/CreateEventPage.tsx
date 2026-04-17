// pages/create-event/CreateEventPage.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchEventById, MOCK_EVENTS } from '@/entities/event';
import { fetchEventTypes as fetchAllEventTypes } from '@/entities/event';
import { fetchEventTypesByEvent } from '@/entities/event/participationApi';
import { apiClient } from '@/shared/api/client';
import { getOrFetchAccountId } from '@/entities/user/api';
import { getWalletByAccount } from '@/entities/user/walletApi';
import { tariffApi, tariffValidatorApi, type ITariffValidator } from '@/entities/admin/adminApi';
import { CategoryTypePicker } from '@/features/event-filters/CategoryTypePicker';
import { YandexMapPicker } from '@/features/event-map/YandexMapPicker';
import { getStoredUserCoords } from '@/features/auth/useUserLocation';
import type { Gender } from '@/shared/api/types';
import styles from './CreateEventPage.module.css';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

// ---- Toast notification ----

interface ToastState {
  message: string;
  visible: boolean;
}

function useToast() {
  const [toast, setToast] = useState<ToastState>({ message: '', visible: false });
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback((message: string) => {
    clearTimeout(timerRef.current);
    setToast({ message, visible: true });
    timerRef.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000);
  }, []);

  return { toast, show };
}

// ---- Form state ----

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

// ---- Validation errors type ----

type FieldError = 'name' | 'type' | 'location' | 'startDate' | 'startTime' | 'endDate' | 'endTime';

export default function CreateEventPage() {
  const navigate  = useNavigate();
  const { id }    = useParams<{ id: string }>();
  const isEditing = !!id;

  const [form, setForm]       = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Set<FieldError>>(new Set());

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // Для новых событий — начальная точка карты из локации пользователя
  const userCoords = getStoredUserCoords();

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTypes,      setSelectedTypes]      = useState<string[]>([]);
  const [pickerOpen,         setPickerOpen]         = useState(false);
  const typeCount = selectedCategories.length + selectedTypes.length;

  // Тариф пользователя (для ограничений параметров)
  const [tariffValidator, setTariffValidator] = useState<ITariffValidator | null>(null);
  const [hasWallet,       setHasWallet]       = useState<boolean | null>(null); // null = загружается

  const { toast, show: showToast } = useToast();

  // Refs for scroll-to-field
  const nameRef      = useRef<HTMLInputElement>(null);
  const typeRef      = useRef<HTMLDivElement>(null);
  const locationRef  = useRef<HTMLDivElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const endDateRef   = useRef<HTMLInputElement>(null);
  const endTimeRef   = useRef<HTMLInputElement>(null);

  // Загружаем кошелёк и тариф (для ограничений параметров)
  useEffect(() => {
    getOrFetchAccountId().then(async accountId => {
      try {
        const wallet = await getWalletByAccount(accountId);
        setHasWallet(!!wallet);
        if (wallet?.tariffId) {
          const tariffs = await tariffApi.getAll().catch(() => []);
          const t = tariffs.find(x => x.id === wallet.tariffId);
          if (t?.validatorId) {
            const v = await tariffValidatorApi.getByTariff(t.id).catch(() => null);
            setTariffValidator(v);
          }
        }
      } catch {
        setHasWallet(false);
      }
    }).catch(() => setHasWallet(false));
  }, []);

  // Load for editing
  useEffect(() => {
    if (!isEditing) return;
    setLoading(true);

    const loadEvent = USE_MOCK
      ? Promise.resolve(MOCK_EVENTS.find(e => e.id === id) ?? MOCK_EVENTS[0])
      : fetchEventById(id!);

    // Загружаем типы события через отдельный эндпоинт — надёжнее чем из ev.eventType
    const loadEventTypes = USE_MOCK
      ? Promise.resolve([])
      : fetchEventTypesByEvent(id!);

    Promise.all([loadEvent, loadEventTypes]).then(([ev, eventTypes]) => {
      const toDate = (iso: string) => iso.slice(0, 10);
      const toTime = (iso: string) => iso.slice(11, 16);
      setForm({
        name:               ev.name ?? '',
        description:        ev.description ?? '',
        address:            ev.address ?? '',
        startDate:          ev.startTime ? toDate(ev.startTime) : '',
        startTime:          ev.startTime ? toTime(ev.startTime) : '',
        endDate:            ev.endTime   ? toDate(ev.endTime)   : '',
        endTime:            ev.endTime   ? toTime(ev.endTime)   : '',
        cost:               String(ev.parameters?.cost ?? 0),
        ageLimit:           String(ev.parameters?.ageLimit ?? ''),
        isPrivate:          ev.parameters?.private ?? false,
        maxPersons:         String(ev.parameters?.maxPersonsCount ?? ''),
        allowUsersToInvite: ev.parameters?.allowUsersToInvite ?? true,
        allowedGender:      ev.parameters?.allowedGender ?? '',
      });
      if (ev.latitude)  setLat(ev.latitude);
      if (ev.longitude) setLng(ev.longitude);

      // Восстанавливаем типы из API byEvent — используем реальные ID из базы
      if (eventTypes.length > 0) {
        const typeIds = eventTypes.map(t => t.id);
        const catIds  = [...new Set(
          eventTypes.map(t => t.eventCategoryId ?? t.eventCategory?.id).filter(Boolean) as string[]
        )];
        setSelectedTypes(typeIds);
        setSelectedCategories(catIds);
      } else if (ev.eventType?.id) {
        // Fallback: хотя бы из самого события если byEvent ничего не вернул
        setSelectedTypes([ev.eventType.id]);
        const catId = ev.eventType.eventCategoryId ?? ev.eventType.eventCategory?.id;
        if (catId) setSelectedCategories([catId]);
      }
    }).finally(() => setLoading(false));
  }, [id, isEditing]);

  const set = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm(f => ({
        ...f,
        [key]: e.target.type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : e.target.value,
      }));
      // Сбрасываем ошибку поля при вводе
      setFieldErrors(prev => {
        const next = new Set(prev);
        if (key === 'name')      next.delete('name');
        if (key === 'address')   next.delete('location');
        if (key === 'startDate') next.delete('startDate');
        if (key === 'startTime') next.delete('startTime');
        if (key === 'endDate')   next.delete('endDate');
        if (key === 'endTime')   next.delete('endTime');
        return next;
      });
    };

  // Scroll + focus helper
  const focusField = (err: FieldError) => {
    const map: Record<FieldError, React.RefObject<HTMLElement | null>> = {
      name:      nameRef,
      type:      typeRef,
      location:  locationRef,
      startDate: startDateRef,
      startTime: startTimeRef,
      endDate:   endDateRef,
      endTime:   endTimeRef,
    };
    const el = map[err]?.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if ('focus' in el && typeof (el as HTMLInputElement).focus === 'function') {
      setTimeout(() => (el as HTMLInputElement).focus(), 300);
    }
  };

  // Validate and collect all errors
  const validate = (): FieldError | null => {
    const errors = new Set<FieldError>();
    if (!form.name.trim())              errors.add('name');
    if (typeCount === 0)                errors.add('type');
    if (!form.address.trim() || lat === null || lng === null) errors.add('location');
    if (!form.startDate)                errors.add('startDate');
    if (!form.startTime)                errors.add('startTime');
    if (!form.endDate)                  errors.add('endDate');
    if (!form.endTime)                  errors.add('endTime');

    setFieldErrors(errors);

    if (errors.size === 0) return null;

    // Return first in order
    const order: FieldError[] = ['name', 'type', 'location', 'startDate', 'startTime', 'endDate', 'endTime'];
    return order.find(e => errors.has(e)) ?? null;
  };

  const handleSubmit = async () => {
    const firstError = validate();
    if (firstError) {
      const messages: Record<FieldError, string> = {
        name:      '⚠️ Укажите название мероприятия',
        type:      '⚠️ Выберите хотя бы один тип мероприятия',
        location:  '⚠️ Укажите адрес и точку на карте',
        startDate: '⚠️ Укажите дату начала мероприятия',
        startTime: '⚠️ Укажите время начала мероприятия',
        endDate:   '⚠️ Укажите дату окончания мероприятия',
        endTime:   '⚠️ Укажите время окончания мероприятия',
      };
      showToast(messages[firstError]);
      focusField(firstError);
      return;
    }

    setSaving(true);
    try {
      const startTime = new Date(`${form.startDate}T${form.startTime}`).toISOString();
      const endTime   = new Date(`${form.endDate}T${form.endTime}`).toISOString();

      if (isEditing) {
        // Обновление: плоский формат согласно API
        const updatePayload = {
          name:        form.name,
          description: form.description || undefined,
          address:     form.address,
          startTime,
          endTime,
          active:      false,
          // location — строковое поле, координаты передаём отдельно если нужно
          ...(lat !== null && lng !== null ? { latitude: lat, longitude: lng } : {}),
        };
        await apiClient.put(`/api/events/update/${id}`, updatePayload);
      } else {
        // Создание: вложенный объект
        const accountId = await getOrFetchAccountId();
        const createPayload = {
          event: {
            name:        form.name,
            description: form.description || undefined,
            address:     form.address,
            latitude:    lat!,
            longitude:   lng!,
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
          eventTypes: selectedTypes,
          organizatorAccountIds: [accountId],
          organizatorOrganizationIds: null,
        };
        await apiClient.post('/api/events/create', createPayload);
      }

      navigate('/my-events');
    } catch (err) {
      showToast(`❌ ${err instanceof Error ? err.message : 'Ошибка сохранения'}`);
    } finally {
      setSaving(false);
    }
  };

  const hasErr = (field: FieldError) => fieldErrors.has(field);

  if (loading) return (
    <div className={styles.page}>
      <div className={styles.skeletonBlock} style={{ height: 40, width: '50%' }} />
      <div className={styles.skeletonBlock} style={{ height: 200 }} />
    </div>
  );

  return (
    <div className={styles.page}>
      {/* Title */}
      <div className={styles.titleBar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>←</button>
        <h2 className={styles.title}>{isEditing ? 'Редактировать событие' : 'Создать событие'}</h2>
      </div>

      <div className={styles.form}>

        {/* Основное */}
        <Section title="Основное">
          <Field label="Название *" error={hasErr('name') ? 'Обязательное поле' : undefined}>
            <input
              ref={nameRef}
              className={`${styles.input} ${hasErr('name') ? styles.inputError : ''}`}
              placeholder="Название мероприятия"
              value={form.name}
              onChange={set('name')}
            />
          </Field>
          <Field label="Описание">
            <textarea className={styles.textarea} rows={4}
              placeholder="Расскажите о мероприятии..." value={form.description}
              onChange={set('description')} />
          </Field>
        </Section>

        {/* Тип */}
        <Section title="Тип мероприятия *" error={hasErr('type') ? 'Выберите хотя бы один тип' : undefined}>
          <div ref={typeRef}>
            <button
              className={`${styles.pickerBtn} ${typeCount > 0 ? styles.pickerBtnActive : ''} ${hasErr('type') ? styles.pickerBtnError : ''}`}
              onClick={() => { setPickerOpen(true); setFieldErrors(p => { const n = new Set(p); n.delete('type'); return n; }); }}
              type="button"
            >
              <span>🎭</span>
              {typeCount > 0 ? `Выбрано типов: ${typeCount}` : 'Выбрать категорию и тип...'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        </Section>

        {/* Место */}
        <Section title="Место *" error={hasErr('location') ? 'Укажите адрес и точку на карте' : undefined}>
          <div ref={locationRef}>
            <YandexMapPicker
              lat={lat}
              lng={lng}
              // Если нет координат события — показываем карту по локации пользователя
              initialCenter={lat === null ? [userCoords.lat, userCoords.lng] : undefined}
              address={form.address}
              hasError={hasErr('location')}
              onAddressChange={addr => {
                setForm(f => ({ ...f, address: addr }));
                if (addr.trim()) setFieldErrors(p => { const n = new Set(p); n.delete('location'); return n; });
              }}
              onPick={(la, lo, addr) => {
                setLat(la); setLng(lo);
                setForm(f => ({ ...f, address: addr }));
                setFieldErrors(p => { const n = new Set(p); n.delete('location'); return n; });
              }}
            />
          </div>
        </Section>

        {/* Дата и время */}
        <Section title="Дата и время *">
          <div className={styles.row}>
            <Field label="Дата начала *" error={hasErr('startDate') ? 'Обязательное' : undefined}>
              <input ref={startDateRef} type="date"
                className={`${styles.input} ${hasErr('startDate') ? styles.inputError : ''}`}
                value={form.startDate} onChange={set('startDate')} />
            </Field>
            <Field label="Время начала *" error={hasErr('startTime') ? 'Обязательное' : undefined}>
              <input ref={startTimeRef} type="time"
                className={`${styles.input} ${hasErr('startTime') ? styles.inputError : ''}`}
                value={form.startTime} onChange={set('startTime')} />
            </Field>
          </div>
          <div className={styles.row}>
            <Field label="Дата окончания *" error={hasErr('endDate') ? 'Обязательное' : undefined}>
              <input ref={endDateRef} type="date"
                className={`${styles.input} ${hasErr('endDate') ? styles.inputError : ''}`}
                value={form.endDate} onChange={set('endDate')} />
            </Field>
            <Field label="Время окончания *" error={hasErr('endTime') ? 'Обязательное' : undefined}>
              <input ref={endTimeRef} type="time"
                className={`${styles.input} ${hasErr('endTime') ? styles.inputError : ''}`}
                value={form.endTime} onChange={set('endTime')} />
            </Field>
          </div>
        </Section>

        {/* Параметры — только если есть кошелёк */}
        {hasWallet && (
          <Section title={tariffValidator ? 'Параметры' : 'Параметры (базовые)'}>
            <Field label="Стоимость (₽, 0 = бесплатно)">
              <input className={styles.input} type="number" min={0} step={50}
                max={tariffValidator?.costLimit || undefined}
                value={form.cost} onChange={set('cost')} />
              {!!tariffValidator?.costLimit && (
                <span className={styles.fieldHint}>Лимит тарифа: до {tariffValidator.costLimit.toLocaleString()} ₽</span>
              )}
            </Field>
            <div className={styles.row}>
              <Field label="Ограничение по возрасту">
                <input className={styles.input} type="number" min={0} max={99}
                  placeholder="Нет" value={form.ageLimit} onChange={set('ageLimit')} />
              </Field>
              <Field label="Макс. участников">
                <input className={styles.input} type="number" min={1}
                  placeholder="∞"
                  max={tariffValidator?.personsLimit || undefined}
                  value={form.maxPersons} onChange={set('maxPersons')} />
                {!!tariffValidator?.personsLimit && (
                  <span className={styles.fieldHint}>Лимит: до {tariffValidator.personsLimit}</span>
                )}
              </Field>
            </div>
            <Field label="Ограничение по полу">
              <select className={styles.input} value={form.allowedGender}
                onChange={set('allowedGender')}
                disabled={tariffValidator ? !tariffValidator.allowGenderSegregation : false}>
                <option value="">Без ограничений</option>
                <option value="Male">Мужской</option>
                <option value="Female">Женский</option>
              </select>
              {tariffValidator && !tariffValidator.allowGenderSegregation && (
                <span className={styles.fieldHintWarn}>Недоступно в текущем тарифе</span>
              )}
            </Field>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={form.isPrivate} onChange={set('isPrivate')}
                disabled={tariffValidator ? !tariffValidator.allowPrivate : false} />
              Приватное мероприятие
              {tariffValidator && !tariffValidator.allowPrivate && (
                <span className={styles.fieldHintWarn}> (недоступно в тарифе)</span>
              )}
            </label>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={form.allowUsersToInvite} onChange={set('allowUsersToInvite')} />
              Участники могут приглашать других
            </label>
          </Section>
        )}

        <Section title="Фото">
          <div className={styles.uploadPlaceholder}>
            🖼 Загрузка обложки и фотографий
            <small>Интеграция: POST /api/media/...</small>
          </div>
        </Section>

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

      {/* Category picker */}
      {pickerOpen && (
        <CategoryTypePicker
          selectedCategories={selectedCategories}
          selectedTypes={selectedTypes}
          onChange={(cats, types) => { setSelectedCategories(cats); setSelectedTypes(types); }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Toast */}
      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}

// ---- Toast notification ----

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div className={`${styles.toast} ${visible ? styles.toastVisible : ''}`}>
      {message}
    </div>
  );
}

// ---- Section & Field helpers ----

function Section({ title, children, error }: {
  title: string; children: React.ReactNode; error?: string;
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitleRow}>
        <h3 className={`${styles.sectionTitle} ${error ? styles.sectionTitleError : ''}`}>{title}</h3>
        {error && <span className={styles.sectionError}>{error}</span>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, error }: {
  label: string; children: React.ReactNode; error?: string;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {children}
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  );
}
