// pages/create-event/CreateEventPage.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchEventById, fetchEventTypes as fetchAllEventTypes, MOCK_EVENTS } from '@/entities/event';
import type { IEventType } from '@/entities/event';
import { fetchEventTypesByEvent } from '@/entities/event/participationApi';
import { apiClient } from '@/shared/api/client';
import { getOrFetchAccountId } from '@/entities/user/api';
import { getWalletByAccount } from '@/entities/user/walletApi';
import { tariffApi, tariffValidatorApi, type ITariffValidator, type ITariff } from '@/entities/admin/adminApi';
import { CategoryTypePicker } from '@/features/event-filters/CategoryTypePicker';
import { YandexMapPicker } from '@/features/event-map/YandexMapPicker';
import { CoverUpload } from '@/shared/ui/CoverUpload/CoverUpload';
import { DatePicker } from '@/shared/ui/DatePicker/DatePicker';
import { InviteModal } from '@/features/event/InviteModal';
import { getStoredUserCoords } from '@/features/auth/useUserLocation';
import type { Gender } from '@/shared/api/types';
import styles from './CreateEventPage.module.css';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

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

type FieldError = 'name' | 'type' | 'location' | 'startDate' | 'startTime' | 'endDate' | 'endTime';

// ---- Helpers ----

function useToast() {
  const [toast, setToast] = useState({ message: '', visible: false });
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = useCallback((message: string) => {
    clearTimeout(timer.current);
    setToast({ message, visible: true });
    timer.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000);
  }, []);
  return { toast, show };
}

// ---- Основной компонент ----

export default function CreateEventPage() {
  const navigate  = useNavigate();
  const { id }    = useParams<{ id: string }>();
  const isEditing = !!id;

  const [form,        setForm]        = useState<FormState>(EMPTY);
  const [loading,     setLoading]     = useState(isEditing);
  const [saving,      setSaving]      = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Set<FieldError>>(new Set());

  const [lat,          setLat]          = useState<number | null>(null);
  const [lng,          setLng]          = useState<number | null>(null);
  const [coverUrl,     setCoverUrl]     = useState<string | null>(null);
  const [coverImageId, setCoverImageId] = useState<string | null>(null);

  const userCoords = getStoredUserCoords();

  // Выбранные типы + полные объекты для отображения чипов
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTypes,      setSelectedTypes]      = useState<string[]>([]);
  const [allTypes,           setAllTypes]           = useState<IEventType[]>([]);
  const [pickerOpen,         setPickerOpen]         = useState(false);

  // Режим окончания
  const [endMode,   setEndMode]   = useState<'duration' | 'multiday'>('duration');
  const [durationH, setDurationH] = useState('2');
  const [durationM, setDurationM] = useState('0');

  // Кошелёк / тариф
  const [tariffValidator, setTariffValidator] = useState<ITariffValidator | null>(null);
  const [tariff,          setTariff]          = useState<ITariff | null>(null);
  const [hasWallet,       setHasWallet]       = useState<boolean | null>(null);

  const { toast, show: showToast } = useToast();

  // Refs
  const nameRef      = useRef<HTMLInputElement>(null);
  const typeRef      = useRef<HTMLDivElement>(null);
  const locationRef  = useRef<HTMLDivElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const endDateRef   = useRef<HTMLInputElement>(null);
  const endTimeRef   = useRef<HTMLInputElement>(null);

  // Загрузка кошелька и тарифа
  useEffect(() => {
    getOrFetchAccountId().then(async accountId => {
      try {
        const wallet = await getWalletByAccount(accountId);
        setHasWallet(!!wallet);
        if (wallet?.tariffId) {
          const tariffs = await tariffApi.getAll().catch(() => []);
          const t = tariffs.find(x => x.id === wallet.tariffId) ?? null;
          setTariff(t);
          if (t?.validatorId) {
            const v = await tariffValidatorApi.getByTariff(t.id).catch(() => null);
            setTariffValidator(v);
          }
        }
      } catch { setHasWallet(false); }
    }).catch(() => setHasWallet(false));
  }, []);

  // Загрузка всех типов для чипов
  useEffect(() => {
    if (USE_MOCK) return;
    fetchAllEventTypes().then(setAllTypes).catch(() => {});
  }, []);

  // Загрузка события для редактирования
  useEffect(() => {
    if (!isEditing) return;
    setLoading(true);
    const loadEvent = USE_MOCK
      ? Promise.resolve(MOCK_EVENTS.find(e => e.id === id) ?? MOCK_EVENTS[0])
      : fetchEventById(id!);
    const loadTypes = USE_MOCK ? Promise.resolve([]) : fetchEventTypesByEvent(id!);

    Promise.all([loadEvent, loadTypes]).then(([ev, evTypes]) => {
      const toDate = (s: string) => s.slice(0, 10);
      const toTime = (s: string) => s.slice(11, 16);
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
      if (ev.latitude)      setLat(ev.latitude);
      if (ev.longitude)     setLng(ev.longitude);
      if (ev.coverUrl)      setCoverUrl(ev.coverUrl);
      if (ev.coverImageId)  setCoverImageId(ev.coverImageId);

      if (ev.startTime && ev.endTime) {
        const diff = new Date(ev.endTime).getTime() - new Date(ev.startTime).getTime();
        const sameDay = new Date(ev.startTime).toDateString() === new Date(ev.endTime).toDateString();
        if (sameDay) {
          setEndMode('duration');
          setDurationH(String(Math.floor(diff / 3600000)));
          setDurationM(String(Math.round((diff % 3600000) / 60000)));
        } else { setEndMode('multiday'); }
      }

      if (evTypes.length > 0) {
        setSelectedTypes(evTypes.map(t => t.id));
        setSelectedCategories([...new Set(evTypes.map(t =>
          t.eventCategoryId ?? (t as any).eventCategory?.id).filter(Boolean) as string[])]);
      } else if (ev.eventType?.id) {
        setSelectedTypes([ev.eventType.id]);
        const catId = ev.eventType.eventCategoryId ?? ev.eventType.eventCategory?.id;
        if (catId) setSelectedCategories([catId]);
      }
    }).finally(() => setLoading(false));
  }, [id, isEditing]);

  // Вспомогательные
  const set = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const val = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
      setForm(f => ({ ...f, [key]: val }));
      const errMap: Partial<Record<keyof FormState, FieldError>> = {
        name: 'name', address: 'location', startDate: 'startDate',
        startTime: 'startTime', endDate: 'endDate', endTime: 'endTime',
      };
      if (errMap[key]) setFieldErrors(p => { const n = new Set(p); n.delete(errMap[key]!); return n; });
    };

  const hasErr = (f: FieldError) => fieldErrors.has(f);
  const typeCount = selectedCategories.length + selectedTypes.length;

  // Чипы выбранных типов
  const selectedTypeObjects = allTypes.filter(t => selectedTypes.includes(t.id));

  // Проверки тарифа
  // Нет тарифа → только бесплатные, без лимита по людям, только 0+
  const tv = tariffValidator;
  const hasTariff        = !!tariff && !!tv;
  const canSetCost       = hasTariff && (tv!.costLimit != null && tv!.costLimit > 0);
  const maxCost          = tv?.costLimit ?? null;
  const canSetMaxPersons = hasTariff && (tv!.personsLimit != null && tv!.personsLimit > 0);
  const maxPersons       = tv?.personsLimit ?? null;
  const canSetPrivate    = hasTariff ? !!tv!.allowPrivate : false;
  const canSetGender     = hasTariff ? !!tv!.allowGenderSegregation : false;
  const canSetAge        = hasTariff && (tv!.ageLimit != null && tv!.ageLimit > 0);
  const maxAge           = tv?.ageLimit ?? null;
  const hasTariffWarning = hasWallet && (!canSetCost || !canSetMaxPersons || !canSetPrivate || !canSetGender || !canSetAge);
  const tariffName       = tariff?.name ?? 'текущем';

  // Validation
  const validate = (): FieldError | null => {
    const errs = new Set<FieldError>();
    if (!form.name.trim()) errs.add('name');
    if (typeCount === 0)   errs.add('type');
    if (!form.address.trim() || lat === null || lng === null) errs.add('location');
    if (!form.startDate)   errs.add('startDate');
    if (!form.startTime)   errs.add('startTime');
    if (endMode === 'multiday') {
      if (!form.endDate) errs.add('endDate');
      if (!form.endTime) errs.add('endTime');
    }
    setFieldErrors(errs);
    if (!errs.size) return null;
    return (['name','type','location','startDate','startTime','endDate','endTime'] as FieldError[])
      .find(f => errs.has(f)) ?? null;
  };

  const scrollTo = (err: FieldError) => {
    const map: Record<FieldError, React.RefObject<HTMLElement | null>> = {
      name: nameRef, type: typeRef, location: locationRef,
      startDate: startDateRef, startTime: startTimeRef,
      endDate: endDateRef, endTime: endTimeRef,
    };
    const el = map[err]?.current;
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  };

  const [createdEventId,  setCreatedEventId]  = useState<string | null>(null);
  const [createdAccountId, setCreatedAccountId] = useState<string>('');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const handleSubmit = async () => {
    const firstErr = validate();
    if (firstErr) {
      showToast({ name:'⚠️ Укажите название', type:'⚠️ Выберите тип мероприятия',
        location:'⚠️ Укажите адрес на карте', startDate:'⚠️ Укажите дату начала',
        startTime:'⚠️ Укажите время начала', endDate:'⚠️ Укажите дату окончания',
        endTime:'⚠️ Укажите время окончания' }[firstErr]);
      scrollTo(firstErr); return;
    }
    setSaving(true);
    try {
      const startDt = new Date(`${form.startDate}T${form.startTime}`);
      const endDt = endMode === 'duration'
        ? new Date(startDt.getTime() + (parseInt(durationH)||0)*3600000 + (parseInt(durationM)||0)*60000)
        : new Date(`${form.endDate}T${form.endTime}`);
      const startTime = startDt.toISOString();
      const endTime   = endDt.toISOString();

      if (isEditing) {
        await apiClient.put(`/api/events/update/${id}`, {
          name: form.name, description: form.description || undefined,
          address: form.address, startTime, endTime, active: true,
          ...(lat !== null && lng !== null ? { latitude: lat, longitude: lng } : {}),
          ...(coverUrl ? { coverUrl } : {}),
          ...(coverImageId ? { coverImageId } : {}),
        });
        navigate('/my-events');
      } else {
        const accountId = await getOrFetchAccountId();
        const createResult = await apiClient.post<string>('/api/events/create', {
          event: {
            name: form.name, description: form.description || undefined,
            address: form.address, latitude: lat!, longitude: lng!,
            startTime, endTime, active: true,
            ...(coverUrl ? { coverUrl } : {}),
            ...(coverImageId ? { coverImageId } : {}),
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
        });
        // Предлагаем пригласить подписчиков
        const newEventId = createResult?.result ?? createResult as unknown as string;
        if (newEventId && accountId) {
          setCreatedEventId(newEventId);
          setCreatedAccountId(accountId);
          setInviteModalOpen(true);
        } else {
          navigate('/my-events');
        }
      }
    } catch (err) {
      showToast(`❌ ${err instanceof Error ? err.message : 'Ошибка сохранения'}`);
    } finally { setSaving(false); }
  };

  const [confirmOpen, setConfirmOpen] = useState(false);

  const handlePublishClick = () => {
    if (isEditing) { handleSubmit(); return; }
    const firstErr = validate();
    if (firstErr) {
      showToast({ name:'⚠️ Укажите название', type:'⚠️ Выберите тип мероприятия',
        location:'⚠️ Укажите адрес на карте', startDate:'⚠️ Укажите дату начала',
        startTime:'⚠️ Укажите время начала', endDate:'⚠️ Укажите дату окончания',
        endTime:'⚠️ Укажите время окончания' }[firstErr]);
      scrollTo(firstErr); return;
    }
    setConfirmOpen(true);
  };
  const checks = [
    { label: 'Название',          done: !!form.name.trim() },
    { label: 'Тип мероприятия',   done: typeCount > 0 },
    { label: 'Место на карте',    done: !!form.address && lat !== null },
    { label: 'Дата и время',      done: !!form.startDate && !!form.startTime },
    { label: 'Обложка',           done: !!coverUrl, optional: true },
  ];

  // Предпросмотр времени
  const previewTime = (() => {
    if (!form.startDate || !form.startTime) return null;
    const start = new Date(`${form.startDate}T${form.startTime}`);
    const end = endMode === 'duration'
      ? new Date(start.getTime() + (parseInt(durationH)||0)*3600000 + (parseInt(durationM)||0)*60000)
      : form.endDate && form.endTime ? new Date(`${form.endDate}T${form.endTime}`) : null;
    const fmt = (d: Date) => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const fmtDate = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    return end ? `${fmtDate(start)} · ${fmt(start)} — ${fmt(end)}` : `${fmtDate(start)} · ${fmt(start)}`;
  })();

  if (loading) return (
    <div className={styles.page}>
      <div className={styles.card} style={{ gridColumn: '1 / -1' }}>
        <div className={styles.header}><div className={styles.backBtn} /><div style={{width:180,height:20,borderRadius:8,background:'rgba(255,255,255,0.2)'}} /></div>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
      {/* ── Левая колонка: форма ── */}
      <div className={styles.card}>

        {/* Хедер */}
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className={styles.title}>{isEditing ? 'Редактировать мероприятие' : 'Новое мероприятие'}</h1>
        </div>

        {/* Обложка */}
        <Section title="Обложка">
          <CoverUpload currentUrl={coverUrl} onUploaded={(url, fileId) => {
            setCoverUrl(url);
            setCoverImageId(fileId);
          }} />
        </Section>

        {/* Основное */}
        <Section title="Основное">
          <Field label="Название *" error={hasErr('name') ? 'Обязательное поле' : undefined}>
            <input ref={nameRef}
              className={`${styles.input} ${hasErr('name') ? styles.inputError : ''}`}
              placeholder="Название мероприятия" value={form.name} onChange={set('name')} 
                  onFocus={e => (e.target as HTMLInputElement).select()} />
          </Field>
          <Field label="Описание">
            <textarea className={`${styles.input} ${styles.textarea}`} rows={3}
              placeholder="Расскажите о мероприятии..." value={form.description} onChange={set('description')} />
          </Field>
        </Section>

        {/* Тип */}
        <Section title="Тип мероприятия *" error={hasErr('type') ? 'Выберите хотя бы один тип' : undefined}>
          <div ref={typeRef}>
            <button
              className={`${styles.pickerBtn} ${typeCount > 0 ? styles.pickerBtnActive : ''} ${hasErr('type') ? styles.pickerBtnError : ''}`}
              onClick={() => { setPickerOpen(true); setFieldErrors(p => { const n = new Set(p); n.delete('type'); return n; }); }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              {typeCount > 0 ? 'Изменить типы' : 'Выбрать категорию и тип...'}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginLeft:'auto'}}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {selectedTypeObjects.length > 0 && (
              <div className={styles.typeChips}>
                {selectedTypeObjects.map(t => (
                  <div key={t.id} className={styles.typeChip}>
                    {t.ico && <img src={t.ico} alt="" width={14} height={14} style={{borderRadius:2}} />}
                    {t.name}
                    <button className={styles.typeChipRemove} onClick={() => {
                      setSelectedTypes(p => p.filter(x => x !== t.id));
                    }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* Место */}
        <Section title="Место *" error={hasErr('location') ? 'Укажите адрес и точку на карте' : undefined}>
          <div ref={locationRef}>
            <YandexMapPicker
              lat={lat} lng={lng}
              initialCenter={lat === null ? [userCoords.lat, userCoords.lng] : undefined}
              address={form.address} hasError={hasErr('location')}
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
          {/* Переключатель режима — вверху */}
          <div className={styles.endModeToggle}>
            <button className={`${styles.modeBtn} ${endMode === 'duration' ? styles.modeBtnActive : ''}`}
              onClick={() => setEndMode('duration')}>По длительности</button>
            <button className={`${styles.modeBtn} ${endMode === 'multiday' ? styles.modeBtnActive : ''}`}
              onClick={() => setEndMode('multiday')}>Многодневное</button>
          </div>

          {/* Две колонки */}
          <div className={endMode === 'duration' ? styles.dateRow : styles.dateRowEqual}>
            {/* Левая — всегда дата начала */}
            <Field label="Начало *" error={hasErr('startDate') || hasErr('startTime') ? 'Укажите дату и время' : undefined}>
              <div ref={startDateRef as any}>
                <DatePicker
                  withTime
                  value={form.startDate && form.startTime ? `${form.startDate}T${form.startTime}` : form.startDate}
                  onChange={iso => {
                    const d = new Date(iso);
                    setForm(f => ({
                      ...f,
                      startDate: iso.slice(0, 10),
                      startTime: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
                    }));
                    setFieldErrors(p => { const n = new Set(p); n.delete('startDate'); n.delete('startTime'); return n; });
                  }}
                  placeholder="Дата и время начала"
                  hasError={hasErr('startDate') || hasErr('startTime')}
                />
              </div>
            </Field>

            {/* Правая — длительность или дата окончания */}
            {endMode === 'duration' ? (
              <Field label="Длительность">
                <div className={styles.durationWheelWrap}>
                  <DurationPicker
                    hours={parseInt(durationH) || 0}
                    minutes={parseInt(durationM) || 0}
                    onChangeHours={h => setDurationH(String(h))}
                    onChangeMinutes={m => setDurationM(String(m))}
                  />
                </div>
              </Field>
            ) : (
              <Field label="Окончание *" error={hasErr('endDate') || hasErr('endTime') ? 'Укажите дату и время' : undefined}>
                <div ref={endDateRef as any}>
                  <DatePicker
                    withTime
                    value={form.endDate && form.endTime ? `${form.endDate}T${form.endTime}` : form.endDate}
                    onChange={iso => {
                      const d = new Date(iso);
                      setForm(f => ({
                        ...f,
                        endDate: iso.slice(0, 10),
                        endTime: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
                      }));
                      setFieldErrors(p => { const n = new Set(p); n.delete('endDate'); n.delete('endTime'); return n; });
                    }}
                    placeholder="Дата и время окончания"
                    hasError={hasErr('endDate') || hasErr('endTime')}
                  />
                </div>
              </Field>
            )}
          </div>
        </Section>

        {/* Параметры (только если есть кошелёк) */}
        {hasWallet && (
          <Section title="Параметры">
            {hasTariffWarning && (
              <div className={styles.tariffBanner}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="#b45309" stroke="none"/></svg>
                <span>{hasTariff
                  ? `Некоторые параметры ограничены тарифом «${tariffName}»`
                  : 'Без тарифа: только бесплатные мероприятия, 0+, без лимита участников'
                }</span>
                <button className={styles.tariffLink} onClick={() => navigate('/wallet')}>
                  {hasTariff ? 'Сменить тариф' : 'Подключить тариф'}
                </button>
              </div>
            )}

            <div className={styles.paramGrid}>
              <Field label="Стоимость, ₽">
                <LockedInput
                  locked={!canSetCost}
                  value={form.cost}
                  onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                  type="number" 
                  max={maxCost ? String(maxCost) : undefined}
                  hint={canSetCost && tariffValidator?.costLimit
                    ? `до ${tariffValidator.costLimit.toLocaleString()} ₽`
                    : !canSetCost ? 'Недоступно в тарифе' : undefined}
                />
              </Field>
              <Field label="Макс. участников">
                <LockedInput
                  locked={!canSetMaxPersons}
                  value={form.maxPersons} placeholder="∞"
                  onChange={e => setForm(f => ({ ...f, maxPersons: e.target.value }))}
                  type="number"
                  max={maxPersons ? String(maxPersons) : undefined}
                  hint={!canSetMaxPersons
                    ? 'Недоступно в тарифе — только без лимита'
                    : maxPersons ? `до ${maxPersons} человек` : undefined}
                />
              </Field>
            </div>

            <Field label="Возрастное ограничение">
              <LockedInput
                locked={!canSetAge}
                value={form.ageLimit} placeholder="0+"
                onChange={e => {
                  const val = e.target.value;
                  // Если в тарифе есть ограничение — не даём ставить выше
                  if (maxAge != null && parseInt(val) > maxAge) return;
                  setForm(f => ({ ...f, ageLimit: val }));
                }}
                type="number"
                max={maxAge ? String(maxAge) : undefined}
                suffix="+"
                hint={!canSetAge
                  ? 'Недоступно в тарифе — только 0+'
                  : maxAge ? `до ${maxAge}+` : undefined}
              />
            </Field>

            <div className={styles.toggles}>
              <Toggle
                label="Приватное мероприятие"
                checked={form.isPrivate}
                locked={!canSetPrivate}
                onChange={v => setForm(f => ({ ...f, isPrivate: v }))}
                lockedHint="Недоступно в тарифе"
              />
              <Toggle
                label="Фильтр участников по полу"
                checked={form.allowedGender !== ''}
                locked={!canSetGender}
                onChange={v => setForm(f => ({ ...f, allowedGender: v ? 'Male' : '' }))}
                lockedHint="Недоступно в тарифе"
              />
              <Toggle
                label="Участники могут приглашать"
                checked={form.allowUsersToInvite}
                onChange={v => setForm(f => ({ ...f, allowUsersToInvite: v }))}
              />
            </div>

            {/* Белый список — только для приватных */}
            {form.isPrivate && canSetPrivate && (
              <div className={styles.whitelist}>
                <div className={styles.whitelistTitle}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Белый список участников
                </div>
                <p className={styles.whitelistHint}>Только эти пользователи смогут записаться на мероприятие</p>
                <div className={styles.whitelistInput}>
                  <input className={styles.input} placeholder="Логин или ID пользователя..." 
                  onFocus={e => (e.target as HTMLInputElement).select()} />
                  <button className={styles.whitelistAdd}>Добавить</button>
                </div>
              </div>
            )}
          </Section>
        )}

        {/* Фотоальбом — заглушка */}
        <Section title="Фотоальбом">
          <div className={styles.albumPlaceholder}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><circle cx="9" cy="15" r="2"/><path d="M14 13l3 3"/></svg>
            <span className={styles.albumHint}>Загрузка фотографий с мероприятия</span>
            <span className={styles.albumSub}>Будет доступно после публикации</span>
          </div>
        </Section>

      </div>

      {/* ── Правая колонка: предпросмотр + кнопки ── */}
      <div className={styles.sidePanel}>

        {/* Карточка предпросмотра */}
        <div className={styles.previewCard}>
          <div className={styles.previewCover}>
            {coverUrl
              ? <img src={coverUrl} alt="Обложка" style={{width:'100%',height:'100%',objectFit:'cover'}} />
              : <span className={styles.previewCoverEmpty}>нет обложки</span>}
          </div>
          <div className={styles.previewBody}>
            <div className={styles.previewName}>{form.name || <span style={{color:'var(--text-muted)'}}>Название мероприятия</span>}</div>
            {(form.isPrivate || form.ageLimit) && (
              <div className={styles.previewBadges}>
                {form.isPrivate && <span className={styles.badgePrivate}>🔒 Приватное</span>}
                {form.ageLimit  && <span className={styles.badgeAge}>{form.ageLimit}+</span>}
              </div>
            )}
            {previewTime && (
              <div className={styles.previewRow}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {previewTime}
              </div>
            )}
            {form.address && (
              <div className={styles.previewRow}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {form.address}
              </div>
            )}
            {parseFloat(form.cost) === 0
              ? <div className={styles.previewFree}>Бесплатно</div>
              : <div className={styles.previewCost}>{parseFloat(form.cost).toLocaleString('ru-RU')} ₽</div>}
          </div>
        </div>

        {/* Чеклист */}
        <div className={styles.checklist}>
          <div className={styles.checklistTitle}>Готовность к публикации</div>
          {checks.map(c => (
            <div key={c.label}
              className={`${styles.checkRow} ${c.done ? styles.checkDone : c.optional ? styles.checkOptional : ''} ${c.label === 'Обложка' ? styles.checklistCoverRow : ''}`}>
              <div className={`${styles.checkDot} ${c.done ? styles.checkDotOk : c.optional ? styles.checkDotOpt : styles.checkDotNo}`}>
                {c.done ? '✓' : c.optional ? '·' : '·'}
              </div>
              {c.label}{c.optional ? ' (необяз.)' : ''}
            </div>
          ))}
        </div>

        {/* Кнопки */}
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={() => navigate(-1)}>Отмена</button>
          <button className={styles.saveBtn} onClick={handlePublishClick} disabled={saving}>
            {saving ? 'Сохранение...' : isEditing ? 'Сохранить' : 'Опубликовать'}
          </button>
        </div>
      </div>{/* end sidePanel */}
      </div>{/* end pageInner */}

      {/* Диалог подтверждения публикации */}
      {confirmOpen && (
        <div className={styles.confirmBackdrop} onClick={() => setConfirmOpen(false)}>
          <div className={styles.confirmDialog} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmIcon}>🚀</div>
            <h3 className={styles.confirmTitle}>Опубликовать мероприятие?</h3>
            <p className={styles.confirmText}>
              «{form.name}» станет видно всем пользователям.
              После публикации вы сможете отредактировать его в любой момент.
            </p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancel} onClick={() => setConfirmOpen(false)}>
                Отмена
              </button>
              <button className={styles.confirmOk} onClick={() => { setConfirmOpen(false); handleSubmit(); }} disabled={saving}>
                {saving ? 'Публикуем...' : 'Опубликовать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Picker */}
      {pickerOpen && (
        <CategoryTypePicker
          selectedCategories={selectedCategories} selectedTypes={selectedTypes}
          onChange={(cats, types) => { setSelectedCategories(cats); setSelectedTypes(types); }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Приглашения после создания события */}
      {inviteModalOpen && createdEventId && (
        <InviteModal
          eventId={createdEventId}
          currentAccountId={createdAccountId}
          onClose={() => { setInviteModalOpen(false); navigate('/my-events'); }}
          onSent={() => { setInviteModalOpen(false); navigate('/my-events'); }}
        />
      )}

      <div className={`${styles.toast} ${toast.visible ? styles.toastVisible : ''}`}>{toast.message}</div>
    </div>
  );
}

// ---- Вспомогательные компоненты ----

function Section({ title, children, error }: { title: string; children: React.ReactNode; error?: string }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={`${styles.sectionLabel} ${error ? styles.sectionLabelError : ''}`}>{title}</span>
        {error && <span className={styles.sectionError}>{error}</span>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {children}
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  );
}

function LockedInput({ locked, hint, suffix, ...props }: {
  locked?: boolean; hint?: string; suffix?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
        <input
          className={`${styles.input} ${locked ? styles.inputLocked : ''}`}
          disabled={locked} {...props}
          style={suffix ? { flex: 1 } : undefined}
        
                  onFocus={e => (e.target as HTMLInputElement).select()} />
        {suffix && <span className={styles.inputSuffix}>{suffix}</span>}
        {locked && <span className={styles.lockBadge}>🔒 тариф</span>}
      </div>
      {hint && <div className={`${styles.fieldHint} ${locked ? styles.fieldHintWarn : ''}`}>{hint}</div>}
    </div>
  );
}

function Toggle({ label, checked, locked, onChange, lockedHint }: {
  label: string; checked: boolean; locked?: boolean;
  onChange: (v: boolean) => void; lockedHint?: string;
}) {
  return (
    <div className={`${styles.toggle} ${locked ? styles.toggleLocked : ''}`}
      onClick={() => !locked && onChange(!checked)}>
      <span className={styles.toggleLabel}>{label}</span>
      {locked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
      <div className={`${styles.switch} ${(checked && !locked) ? styles.switchOn : ''}`}>
        <div className={styles.switchDot} />
      </div>
      {locked && lockedHint && <span className={styles.toggleHint}>{lockedHint}</span>}
    </div>
  );
}

// ── Пикер длительности: кнопка → модальные колёса ─────────────────────────
const HOURS_LIST   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES_LIST = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

function DurationPicker({ hours, minutes, onChangeHours, onChangeMinutes }: {
  hours: number; minutes: number;
  onChangeHours: (h: number) => void;
  onChangeMinutes: (m: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftH, setDraftH] = useState(hours);
  const [draftM, setDraftM] = useState(Math.round(minutes / 5) * 5);

  const handleOpen = () => {
    setDraftH(hours);
    setDraftM(Math.round(minutes / 5) * 5);
    setOpen(true);
  };

  const handleConfirm = () => {
    onChangeHours(draftH);
    onChangeMinutes(draftM);
    setOpen(false);
  };

  const hh = String(hours).padStart(2, '0');
  const mm = String(Math.round(minutes / 5) * 5).padStart(2, '0');

  return (
    <>
      {/* Кнопка-поле — одна строка в стиле DatePicker */}
      <button type="button" onClick={handleOpen} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '8px 12px',
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 13, color: (hours === 0 && minutes === 0) ? 'var(--text-muted)' : 'var(--text-primary)',
        transition: 'border-color .15s',
      }}
        onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
        onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        {(hours === 0 && minutes === 0)
          ? 'Выберите длительность'
          : `${hh} ч ${mm} мин`}
      </button>

      {/* Модальный пикер */}
      {open && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000,
          }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10001, width: 'min(220px, 90vw)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 16, overflow: 'hidden',
            boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
          }}>
            <div style={{ padding: '12px 16px 8px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
              Длительность
            </div>
            {/* Лейблы над колёсами */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 16px 0' }}>
              <div style={{ width: 64, textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Ч</div>
              <div style={{ width: 16 }} />
              <div style={{ width: 64, textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>М</div>
            </div>
            {/* Колёса */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '6px 16px 12px' }}>
              <DurationWheel items={HOURS_LIST}   selected={String(draftH).padStart(2,'0')} onSelect={v => setDraftH(parseInt(v,10))} />
              <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1 }}>:</span>
              <DurationWheel items={MINUTES_LIST} selected={String(draftM).padStart(2,'0')} onSelect={v => setDraftM(parseInt(v,10))} />
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
              <button type="button" onClick={() => setOpen(false)} style={{
                flex: 1, background: 'none', border: '1px solid var(--border)',
                borderRadius: 9, padding: '9px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer',
              }}>Отмена</button>
              <button type="button" onClick={handleConfirm} style={{
                flex: 2, background: 'var(--accent)', border: 'none',
                borderRadius: 9, padding: '9px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
              }}>Выбрать</button>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function DurationWheel({ items, selected, onSelect }: {
  items: string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  const ITEM_H  = 36;
  const VISIBLE = 5;
  const listRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(() => Math.max(0, items.indexOf(selected)));

  useEffect(() => {
    const i = Math.max(0, items.indexOf(selected));
    setIdx(i);
    if (listRef.current) listRef.current.scrollTop = i * ITEM_H;
  }, [selected, items]);

  const handleScroll = () => {
    if (!listRef.current) return;
    const i = Math.round(listRef.current.scrollTop / ITEM_H);
    const clamped = Math.min(i, items.length - 1);
    if (clamped !== idx) { setIdx(clamped); onSelect(items[clamped]); }
  };

  const scrollToIdx = (i: number) => {
    const clamped = Math.max(0, Math.min(items.length - 1, i));
    setIdx(clamped);
    onSelect(items[clamped]);
    listRef.current?.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' });
  };

  return (
    <div style={{
      position: 'relative', width: 64, height: ITEM_H * VISIBLE,
      background: 'var(--surface-2)', borderRadius: 10,
      border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', left: 4, right: 4,
        top: ITEM_H * Math.floor(VISIBLE / 2),
        height: ITEM_H, background: 'rgba(99,102,241,.15)',
        borderRadius: 8, pointerEvents: 'none', zIndex: 1,
      }} />
      <div ref={listRef} onScroll={handleScroll} style={{
        height: '100%', overflowY: 'scroll',
        scrollSnapType: 'y mandatory', scrollbarWidth: 'none',
      }}>
        <div style={{ height: ITEM_H * Math.floor(VISIBLE / 2) }} />
        {items.map((v, i) => (
          <div key={v} onClick={() => scrollToIdx(i)} style={{
            height: ITEM_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: i === idx ? 22 : 16, fontWeight: i === idx ? 600 : 400,
            color: i === idx ? 'var(--text-primary)' : 'var(--text-muted)',
            scrollSnapAlign: 'center', cursor: 'pointer',
            transition: 'font-size .1s, color .1s', userSelect: 'none',
          }}>{v}</div>
        ))}
        <div style={{ height: ITEM_H * Math.floor(VISIBLE / 2) }} />
      </div>
    </div>
  );
}
