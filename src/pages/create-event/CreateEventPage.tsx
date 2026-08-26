// pages/create-event/CreateEventPage.tsx

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { HeroBackButton } from '@/shared/ui/HeroBackButton';
import {
  fetchEventById,
  fetchEventTypes as fetchAllEventTypes,
  fetchEventCategories,
  MOCK_EVENTS,
  assignEventParameters,
  assignEventTypes,
  fetchEventParameters,
  fetchEventOrganizators,
  createEventTemplate,
  updateEventTemplate,
  searchEventTemplates,
  type ICreateEventPayload,
  type IEventTemplate,
} from '@/entities/event';
import type { IEvent, IEventType } from '@/entities/event';
import {
  fetchEventTypesByEvent,
  getBWList,
  addToBWList,
  removeFromBWList,
  canInviteSubscriber,
  type BWListType,
  type IBWListUser,
} from '@/entities/event/participationApi';
import { apiClient } from '@/shared/api/client';
import { fetchAccountById, getOrFetchAccountId } from '@/entities/user/api';
import { useAccountId } from '@/features/auth/useAccountId';
import { getWalletByAccount, getWalletByOrganization } from '@/entities/user/walletApi';
import { tariffApi, tariffValidatorApi, type ITariffValidator, type ITariff } from '@/entities/admin/adminApi';
import {
  canOrganizationHostEvents,
  fetchMyOrganizations,
  fetchOrganizationById,
  filterOrganizationsEligibleToHostEvents,
} from '@/entities/organization';
import { CategoryTypePicker } from '@/features/event-filters/CategoryTypePicker';
import { YandexMapPicker } from '@/features/event-map/YandexMapPicker';
import { CoverUpload } from '@/shared/ui/CoverUpload/CoverUpload';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { DatePicker } from '@/shared/ui/DatePicker/DatePicker';
import { DurationPicker } from '@/shared/ui/DurationPicker/DurationPicker';
import { InviteModal } from '@/features/event/InviteModal';
import {
  OrgAgreementAcceptDialog,
  collectOutdatedOrgAgreements,
  orgAgreementMissingMessage,
  type PendingOrgAgreement,
} from '@/features/agreements';
import { createConversation } from '@/entities/conversation';
import { EventTypeChip } from '@/shared/ui/EventTypeChip';
import { getStoredUserCoords } from '@/features/auth/useUserLocation';
import {
  addDaysLocalDateString,
  apiIsoToLocalParts,
  formatLocalDateLongRu,
  localPartsToApiIso,
  todayLocalDateString,
} from '@/shared/lib/datetime';
import type { Gender } from '@/shared/api/types';
import { usePageTitle } from '@/shared/hooks';
import { useSafeBack } from '@/shared/lib/useSafeBack';
import { WhitelistModal } from './WhitelistModal';
import type { IWhitelistUser } from './WhitelistModal';
import {
  CreateEventHostChooser,
  type CreateEventHost,
} from './CreateEventHostChooser';
import { buildEventCoverBackground } from '@/shared/lib/eventCoverGradient';
import {
  getMaxEventAgeForTariff,
  isEventAgeAllowed,
  resolveAgeLimitBadge,
} from '@/shared/lib/ageLimit';
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
  ticketsEnabled: boolean;
}

const EMPTY: FormState = {
  name: '', description: '', address: '',
  startDate: '', startTime: '', endDate: '', endTime: '',
  cost: '0', ageLimit: '', isPrivate: false,
  maxPersons: '', allowUsersToInvite: true, allowedGender: '',
  ticketsEnabled: false,
};

async function resolveAccountIdsToUsers(ids: string[]): Promise<IWhitelistUser[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  return Promise.all(unique.map(async accountId => {
    try {
      const account = await fetchAccountById(accountId);
      return {
        accountId: account.id,
        login: account.login,
        avatarId: account.avatarId ?? null,
        firstName: null,
        lastName: null,
      };
    } catch {
      return {
        accountId,
        login: accountId.slice(0, 8),
        avatarId: null,
        firstName: null,
        lastName: null,
      };
    }
  }));
}

/** Восстанавливает состояние пикера: категория — только если выбраны все её типы */
function deriveCategoryTypeSelection(
  eventTypeIds: string[],
  catalog: IEventType[],
): { selectedCategories: string[]; selectedTypes: string[] } {
  if (!eventTypeIds.length) {
    return { selectedCategories: [], selectedTypes: [] };
  }
  if (!catalog.length) {
    return { selectedCategories: [], selectedTypes: [...eventTypeIds] };
  }

  const selectedSet = new Set(eventTypeIds);
  const typesByCategory = new Map<string, string[]>();

  for (const t of catalog) {
    const catId = t.eventCategoryId;
    if (!catId) continue;
    const list = typesByCategory.get(catId) ?? [];
    list.push(t.id);
    typesByCategory.set(catId, list);
  }

  const selectedCategories: string[] = [];
  const coveredByCategory = new Set<string>();

  for (const [catId, catTypeIds] of typesByCategory) {
    if (catTypeIds.length > 0 && catTypeIds.every(typeId => selectedSet.has(typeId))) {
      selectedCategories.push(catId);
      catTypeIds.forEach(typeId => coveredByCategory.add(typeId));
    }
  }

  return {
    selectedCategories,
    selectedTypes: eventTypeIds.filter(typeId => !coveredByCategory.has(typeId)),
  };
}

type FieldError = 'name' | 'type' | 'location' | 'startDate' | 'startTime' | 'duration' | 'endDate' | 'endTime' | 'cost' | 'maxPersons' | 'ageLimit';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const isEditing = !!id;
  const goBack    = useSafeBack('/');
  usePageTitle(isEditing ? 'Редактирование события' : 'Создать событие');
  const { accountId } = useAccountId();

  const hostParam = searchParams.get('host');
  const orgIdParam = searchParams.get('organizationId');

  const [hostGate, setHostGate] = useState<'checking' | 'chooser' | 'form'>(
    isEditing ? 'form' : 'checking',
  );
  const [eventHost, setEventHost] = useState<CreateEventHost | null>(null);
  const [canChooseHost, setCanChooseHost] = useState(false);
  const skipHostGateEffectRef = useRef(false);

  const [form,        setForm]        = useState<FormState>(EMPTY);
  const [loading,     setLoading]     = useState(isEditing);
  const [saving,      setSaving]      = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Set<FieldError>>(new Set());

  const [lat,          setLat]          = useState<number | null>(null);
  const [lng,          setLng]          = useState<number | null>(null);
  const [coverUrl,     setCoverUrl]     = useState<string | null>(null);
  const [coverImageId, setCoverImageId] = useState<string | null>(null);

  const userCoords = getStoredUserCoords() ?? { lat: 55.7558, lng: 37.6173 };

  // Выбранные типы + полные объекты для отображения чипов
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTypes,      setSelectedTypes]      = useState<string[]>([]);
  const [allTypes,           setAllTypes]           = useState<IEventType[]>([]);
  const [pickerOpen,         setPickerOpen]         = useState(false);

  // Режим окончания
  const [endMode,   setEndMode]   = useState<'duration' | 'multiday'>('duration');
  const [durationH, setDurationH] = useState('2');
  const [durationM, setDurationM] = useState('0');
  const [whitelist, setWhitelist] = useState<IWhitelistUser[]>([]);
  const [blacklist, setBlacklist] = useState<IWhitelistUser[]>([]);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [invitePickerOpen, setInvitePickerOpen] = useState(false);
  const [inviteUserIds, setInviteUserIds] = useState<string[]>([]);
  const [autoInviteEnabled, setAutoInviteEnabled] = useState(false);
  const [autoInviteMode, setAutoInviteMode] = useState<'all' | 'select'>('select');

  // Кошелёк / тариф
  const [tariffValidator, setTariffValidator] = useState<ITariffValidator | null>(null);
  const [tariff,          setTariff]          = useState<ITariff | null>(null);
  const [hasWallet,       setHasWallet]       = useState<boolean | null>(null);
  /** true, когда загрузка кошелька/тарифа завершена (чтобы не сбросить ageLimit в 0+ раньше времени) */
  const [tariffReady,     setTariffReady]     = useState(false);
  /** Редактирование: доступность продажи билетов у организации-организатора */
  const [editTicketsCapability, setEditTicketsCapability] = useState<'unknown' | 'yes' | 'no'>('unknown');
  /** Шаблон, выбранный на chooser — применяем к форме один раз */
  const [pendingTemplate, setPendingTemplate] = useState<IEventTemplate | null>(null);
  /** Исходный шаблон (для предложения обновления при сохранении) */
  const [sourceTemplate, setSourceTemplate] = useState<IEventTemplate | null>(null);
  const templateAppliedRef = useRef(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [saveTemplateMode, setSaveTemplateMode] = useState<'new' | 'update'>('new');
  const [updateTemplateId, setUpdateTemplateId] = useState<string | null>(null);
  const [existingTemplates, setExistingTemplates] = useState<IEventTemplate[]>([]);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [overwriteConfirmOpen, setOverwriteConfirmOpen] = useState(false);
  const [orgAgreementQueue, setOrgAgreementQueue] = useState<PendingOrgAgreement[]>([]);
  const [orgAgreementResume, setOrgAgreementResume] = useState<'publish' | 'enableTickets' | null>(null);
  const [checkingOrgAgreements, setCheckingOrgAgreements] = useState(false);

  const { toast, show: showToast } = useToast();

  const canEnableTickets = useMemo(() => {
    if (isEditing) return editTicketsCapability === 'yes';
    return eventHost?.kind === 'organization' && eventHost.canSellTickets;
  }, [isEditing, editTicketsCapability, eventHost]);

  // Refs
  const nameRef          = useRef<HTMLInputElement>(null);
  const typeRef          = useRef<HTMLDivElement>(null);
  const locationRef      = useRef<HTMLDivElement>(null);
  const startDateRef     = useRef<HTMLInputElement>(null);
  const startTimeRef     = useRef<HTMLInputElement>(null);
  const endDateRef       = useRef<HTMLInputElement>(null);
  const endTimeRef       = useRef<HTMLInputElement>(null);
  const durationRef      = useRef<HTMLDivElement>(null);
  const loadedBWListsRef = useRef<Set<BWListType>>(new Set());
  const initialEventTypeIdsRef = useRef<string[] | null>(null);
  const initialTypesAppliedRef = useRef(false);
  const allTypesRef = useRef<IEventType[]>([]);

  // Выбор хозяина события (пользователь / активная организация с офертой)
  useEffect(() => {
    if (skipHostGateEffectRef.current) {
      skipHostGateEffectRef.current = false;
      return;
    }
    if (isEditing) {
      setHostGate('form');
      setCanChooseHost(false);
      return;
    }

    if (hostParam === 'user') {
      let cancelled = false;
      fetchMyOrganizations()
        .then(list => filterOrganizationsEligibleToHostEvents(list))
        .then(eligible => {
          if (cancelled) return;
          setCanChooseHost(eligible.length > 0);
          setEventHost({ kind: 'user' });
          setHostGate('form');
        })
        .catch(() => {
          if (cancelled) return;
          setCanChooseHost(false);
          setEventHost({ kind: 'user' });
          setHostGate('form');
        });
      return () => { cancelled = true; };
    }

    if (hostParam === 'org' && orgIdParam) {
      let cancelled = false;
      (async () => {
        try {
          const list = await fetchMyOrganizations();
          if (cancelled) return;
          const org = list.find(o => o.id === orgIdParam) ?? null;
          const eligibleList = await filterOrganizationsEligibleToHostEvents(list);
          if (cancelled) return;
          setCanChooseHost(eligibleList.length > 0);

          const allowed = org
            ? await canOrganizationHostEvents(orgIdParam, org)
            : false;
          if (cancelled) return;

          if (!allowed) {
            // Нет активной org / оферты — вернёмся к выбору хоста
            setEventHost(null);
            setHostGate('chooser');
            setSearchParams({}, { replace: true });
            return;
          }

          setEventHost({
            kind: 'organization',
            organizationId: orgIdParam,
            organizationName: org?.name ?? 'Организация',
            canSellTickets: Boolean(org?.canSellTickets),
          });
          setHostGate('form');
        } catch {
          if (cancelled) return;
          setEventHost(null);
          setHostGate('chooser');
          setSearchParams({}, { replace: true });
        }
      })();
      return () => { cancelled = true; };
    }

    let cancelled = false;
    setHostGate('checking');
    fetchMyOrganizations()
      .then(() => {
        if (cancelled) return;
        // Chooser нужен всегда: хост (если есть org) + шаблоны
        setCanChooseHost(true);
        setHostGate('chooser');
      })
      .catch(() => {
        if (cancelled) return;
        setCanChooseHost(true);
        setHostGate('chooser');
      });
    return () => { cancelled = true; };
  }, [isEditing, hostParam, orgIdParam, setSearchParams]);

  // Загрузка кошелька и тарифа (личный или организации)
  useEffect(() => {
    if (hostGate !== 'form' || !eventHost) return;

    setTariffReady(false);
    setTariff(null);
    setTariffValidator(null);
    setHasWallet(null);

    let cancelled = false;
    (async () => {
      try {
        if (eventHost.kind === 'organization') {
          const wallet = await getWalletByOrganization(eventHost.organizationId);
          if (cancelled) return;
          setHasWallet(!!wallet);
          if (wallet?.tariffId) {
            const tariffs = await tariffApi.getAll(true).catch(() => []);
            if (cancelled) return;
            const t = tariffs.find(x => x.id === wallet.tariffId) ?? null;
            setTariff(t);
            if (t?.validatorId) {
              const v = await tariffValidatorApi.getByTariff(t.id).catch(() => null);
              if (!cancelled) setTariffValidator(v);
            }
          }
        } else {
          const accountId = await getOrFetchAccountId();
          const wallet = await getWalletByAccount(accountId);
          if (cancelled) return;
          setHasWallet(!!wallet);
          if (wallet?.tariffId) {
            const tariffs = await tariffApi.getAll(false).catch(() => []);
            if (cancelled) return;
            const t = tariffs.find(x => x.id === wallet.tariffId) ?? null;
            setTariff(t);
            if (t?.validatorId) {
              const v = await tariffValidatorApi.getByTariff(t.id).catch(() => null);
              if (!cancelled) setTariffValidator(v);
            }
          }
        }
      } catch {
        if (!cancelled) setHasWallet(false);
      } finally {
        if (!cancelled) setTariffReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, [hostGate, eventHost]);

  // Загрузка всех типов и категорий для чипов (цвета категорий)
  useEffect(() => {
    if (USE_MOCK) return;
    Promise.all([fetchAllEventTypes(), fetchEventCategories()])
      .then(([types, categories]) => {
        const catMap = new Map(categories.map(c => [c.id, c]));
        const mapped = types.map(t => ({
          ...t,
          eventCategory: catMap.get(t.eventCategoryId) ?? t.eventCategory ?? null,
        }));
        setAllTypes(mapped);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    allTypesRef.current = allTypes;
  }, [allTypes]);

  // Сброс формы при переходе из редактирования в создание (тот же компонент, React не размонтирует)
  useEffect(() => {
    if (isEditing) return;

    setForm(EMPTY);
    setLoading(false);
    setSaving(false);
    setFieldErrors(new Set());
    setLat(null);
    setLng(null);
    setCoverUrl(null);
    setCoverImageId(null);
    setSelectedCategories([]);
    setSelectedTypes([]);
    setPickerOpen(false);
    setEndMode('duration');
    setDurationH('2');
    setDurationM('0');
    setWhitelist([]);
    setBlacklist([]);
    setListModalOpen(false);
    setInviteUserIds([]);
    setAutoInviteEnabled(false);
    setAutoInviteMode('select');
    setSourceTemplate(null);
    loadedBWListsRef.current = new Set();
    initialEventTypeIdsRef.current = null;
    initialTypesAppliedRef.current = false;
    templateAppliedRef.current = false;
  }, [isEditing, id]);

  // Применение шаблона с chooser (включая даты, приглашения и ч/б списки)
  useEffect(() => {
    if (isEditing || hostGate !== 'form' || !pendingTemplate || templateAppliedRef.current) return;
    const applied = pendingTemplate;
    const body = applied.templateBody;
    if (!body) {
      templateAppliedRef.current = true;
      setSourceTemplate(applied);
      setPendingTemplate(null);
      return;
    }

    const ev = body.event ?? {};
    const params = body.eventParameters ?? {};
    const typeIds = Array.isArray(body.eventTypes) ? body.eventTypes.map(String) : [];
    const startParts = ev.startTime ? apiIsoToLocalParts(String(ev.startTime)) : { date: '', time: '' };
    const endParts = ev.endTime ? apiIsoToLocalParts(String(ev.endTime)) : { date: '', time: '' };

    setForm(f => ({
      ...f,
      name: ev.name ?? '',
      description: (ev.description as string | null | undefined) ?? '',
      address: (ev.address as string | null | undefined) ?? '',
      cost: String(params.cost ?? 0),
      ageLimit: params.ageLimit == null || Number.isNaN(Number(params.ageLimit))
        ? ''
        : String(Math.max(0, Math.trunc(Number(params.ageLimit)))),
      isPrivate: Boolean(params.private),
      maxPersons: params.maxPersonsCount != null ? String(params.maxPersonsCount) : '',
      allowUsersToInvite: params.allowUsersToInvite ?? true,
      allowedGender: (params.allowedGender as Gender | '' | null | undefined) ?? '',
      ticketsEnabled: Boolean(params.ticketsEnabled),
      startDate: startParts.date,
      startTime: startParts.time,
      endDate: endParts.date,
      endTime: endParts.time,
    }));

    if (typeof ev.latitude === 'number') setLat(ev.latitude);
    if (typeof ev.longitude === 'number') setLng(ev.longitude);
    if (ev.coverUrl) setCoverUrl(String(ev.coverUrl));
    if (ev.coverImageId) setCoverImageId(String(ev.coverImageId));

    if (ev.startTime && ev.endTime) {
      const diff = new Date(String(ev.endTime)).getTime() - new Date(String(ev.startTime)).getTime();
      const sameDay = new Date(String(ev.startTime)).toDateString()
        === new Date(String(ev.endTime)).toDateString();
      if (sameDay && diff >= 0) {
        setEndMode('duration');
        let dh = Math.floor(diff / 3600000);
        let dm = Math.max(0, Math.round((diff % 3600000) / 60000));
        if (dm >= 60) { dh += 1; dm = 0; }
        setDurationH(String(dh));
        setDurationM(String(dm));
      } else {
        setEndMode('multiday');
      }
    }

    if (typeIds.length > 0) {
      const catalog = allTypesRef.current;
      if (catalog.length > 0) {
        const selection = deriveCategoryTypeSelection(typeIds, catalog);
        setSelectedCategories(selection.selectedCategories);
        setSelectedTypes(selection.selectedTypes);
      } else {
        setSelectedTypes(typeIds);
        initialEventTypeIdsRef.current = typeIds;
        initialTypesAppliedRef.current = false;
      }
    }

    setSourceTemplate(applied);
    templateAppliedRef.current = true;
    setPendingTemplate(null);
    showToast('Шаблон применён');

    const blackIds = [
      ...(body.blackList ?? []),
      ...(body.BlackList ?? []),
    ].map(String).filter(Boolean);
    const whiteIds = [
      ...(body.whiteList ?? []),
      ...(body.WhiteList ?? []),
    ].map(String).filter(Boolean);
    const inviteIds = [
      ...(body.inviteUsers ?? []),
      ...(body.InviteUsers ?? []),
    ].map(String).filter(Boolean);
    const inviteAll = Boolean(
      body.inviteAllSubscribers ?? body.InviteAllSubscribers,
    );

    let cancelled = false;
    (async () => {
      const [blackUsers, whiteUsers] = await Promise.all([
        resolveAccountIdsToUsers([...new Set(blackIds)]),
        resolveAccountIdsToUsers([...new Set(whiteIds)]),
      ]);
      if (cancelled) return;
      setBlacklist(blackUsers);
      setWhitelist(whiteUsers);

      if (inviteAll) {
        setAutoInviteEnabled(true);
        setAutoInviteMode('all');
        setInviteUserIds([]);
      } else if (inviteIds.length > 0) {
        setAutoInviteEnabled(true);
        setAutoInviteMode('select');
        setInviteUserIds([...new Set(inviteIds)]);
      }
    })();

    return () => { cancelled = true; };
  }, [isEditing, hostGate, pendingTemplate, showToast]);

  // Загрузка события для редактирования
  useEffect(() => {
    if (!isEditing) return;
    initialTypesAppliedRef.current = false;
    initialEventTypeIdsRef.current = null;
    setLoading(true);
    const loadEvent = USE_MOCK
      ? Promise.resolve(MOCK_EVENTS.find(e => e.id === id) ?? MOCK_EVENTS[0])
      : fetchEventById(id!);
    const loadTypes = USE_MOCK ? Promise.resolve([]) : fetchEventTypesByEvent(id!);
    const loadParams = USE_MOCK
      ? Promise.resolve(null)
      : fetchEventParameters(id!).catch(() => null);

    Promise.all([loadEvent, loadTypes, loadParams]).then(([ev, evTypes, params]) => {
      const evRaw = ev as IEvent & Record<string, unknown>;
      const embedded = (ev.parameters
        ?? (evRaw as { Parameters?: typeof ev.parameters }).Parameters
        ?? null) as (NonNullable<typeof ev.parameters> & Record<string, unknown>) | null;
      const parameters = params ?? (embedded
        ? {
            ...embedded,
            ageLimit: (
              embedded.ageLimit
              ?? embedded.AgeLimit
              ?? evRaw.ageLimit
              ?? evRaw.AgeLimit
              ?? null
            ) as number | null,
          }
        : null);
      const rawAge = parameters?.ageLimit
        ?? (parameters as { AgeLimit?: number } | null)?.AgeLimit
        ?? (evRaw.ageLimit as number | null | undefined)
        ?? (evRaw.AgeLimit as number | null | undefined)
        ?? null;
      const startParts = ev.startTime ? apiIsoToLocalParts(ev.startTime) : { date: '', time: '' };
      const endParts = ev.endTime ? apiIsoToLocalParts(ev.endTime) : { date: '', time: '' };
      setForm({
        name:               ev.name ?? '',
        description:        ev.description ?? '',
        address:            ev.address ?? '',
        startDate:          startParts.date,
        startTime:          startParts.time,
        endDate:            endParts.date,
        endTime:            endParts.time,
        cost:               String(parameters?.cost ?? 0),
        ageLimit:           rawAge == null || Number.isNaN(Number(rawAge))
          ? ''
          : String(Math.max(0, Math.trunc(Number(rawAge)))),
        isPrivate:          parameters?.private ?? false,
        maxPersons:         String(parameters?.maxPersonsCount ?? ''),
        allowUsersToInvite: parameters?.allowUsersToInvite ?? true,
        allowedGender:      parameters?.allowedGender ?? '',
        ticketsEnabled:     Boolean(parameters?.ticketsEnabled),
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
          let dh = Math.floor(diff / 3600000);
          let dm = Math.round((diff % 3600000) / 60000);
          if (dm >= 60) { dh += 1; dm = 0; }
          setDurationH(String(dh));
          setDurationM(String(dm));
        } else { setEndMode('multiday'); }
      }

      // Загружаем только нужный список при открытии
      const neededList: BWListType = (parameters?.private ?? false) ? 'whiteList' : 'blackList';
      loadedBWListsRef.current.add(neededList);
      getBWList(neededList, id!).then(items => {
        const mapped = mapBWListItems(items);
        if (neededList === 'blackList') setBlacklist(mapped);
        else setWhitelist(mapped);
      }).catch(() => { loadedBWListsRef.current.delete(neededList); });

      const typeIds = evTypes.length > 0
        ? evTypes.map(t => t.id)
        : ev.eventType?.id
          ? [ev.eventType.id]
          : [];

      initialEventTypeIdsRef.current = typeIds;

      if (typeIds.length > 0) {
        const catalog = allTypesRef.current;
        if (catalog.length > 0) {
          const selection = deriveCategoryTypeSelection(typeIds, catalog);
          setSelectedCategories(selection.selectedCategories);
          setSelectedTypes(selection.selectedTypes);
          initialTypesAppliedRef.current = true;
        } else {
          setSelectedCategories([]);
          setSelectedTypes(typeIds);
        }
      } else {
        setSelectedCategories([]);
        setSelectedTypes([]);
      }
    }).finally(() => setLoading(false));
  }, [id, isEditing]);

  // Редактирование: хост события (организация / пользователь) и тариф организации
  useEffect(() => {
    if (!isEditing || !id) {
      setEditTicketsCapability('unknown');
      return;
    }
    let cancelled = false;
    setEditTicketsCapability('unknown');
    (async () => {
      try {
        const organizers = await fetchEventOrganizators(id);
        const orgOrganizer = organizers.find(o => o.organizationId);
        if (orgOrganizer?.organizationId) {
          const orgId = orgOrganizer.organizationId;
          const org = await fetchOrganizationById(orgId).catch(() => null);
          if (cancelled) return;
          setEventHost({
            kind: 'organization',
            organizationId: orgId,
            organizationName:
              orgOrganizer.organizationName?.trim()
              || org?.name
              || 'Организация',
            canSellTickets: Boolean(org?.canSellTickets),
          });
          setEditTicketsCapability(org?.canSellTickets ? 'yes' : 'no');
          return;
        }
        if (!cancelled) {
          setEventHost({ kind: 'user' });
          setEditTicketsCapability('no');
        }
      } catch {
        if (!cancelled) {
          setEventHost({ kind: 'user' });
          setEditTicketsCapability('no');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isEditing, id]);

  // Сброс флага билетов, если продажа недоступна или стоимость 0
  useEffect(() => {
    if (!form.ticketsEnabled) return;
    const cost = parseFloat(form.cost) || 0;
    if (cost <= 0) {
      setForm(f => (f.ticketsEnabled ? { ...f, ticketsEnabled: false } : f));
      return;
    }
    // В edit не сбрасываем, пока не узнали capability (иначе гасим значение с сервера)
    if (isEditing && editTicketsCapability === 'unknown') return;
    if (!canEnableTickets) {
      setForm(f => (f.ticketsEnabled ? { ...f, ticketsEnabled: false } : f));
    }
  }, [canEnableTickets, editTicketsCapability, form.cost, form.ticketsEnabled, isEditing]);

  // Если типы мероприятия загрузились раньше справочника — применить выбор после allTypes
  useEffect(() => {
    if (!isEditing || initialTypesAppliedRef.current) return;
    const typeIds = initialEventTypeIdsRef.current;
    if (!typeIds?.length || !allTypes.length) return;

    const selection = deriveCategoryTypeSelection(typeIds, allTypes);
    setSelectedCategories(selection.selectedCategories);
    setSelectedTypes(selection.selectedTypes);
    initialTypesAppliedRef.current = true;
  }, [isEditing, allTypes]);

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

  const mapBWListItems = (items: IBWListUser[]): IWhitelistUser[] =>
    items.map(item => ({
      accountId:    item.accountId,
      login:        item.account.login,
      firstName:    item.personInfo?.firstName ?? null,
      lastName:     item.personInfo?.lastName  ?? null,
      avatarId: item.account.avatarId ?? null,
    }));

  const ensureBWListLoaded = useCallback(async (listType: BWListType) => {
    if (!id || loadedBWListsRef.current.has(listType)) return;
    loadedBWListsRef.current.add(listType);
    try {
      const items = await getBWList(listType, id);
      const mapped = mapBWListItems(items);
      if (listType === 'blackList') setBlacklist(mapped);
      else setWhitelist(mapped);
    } catch {
      loadedBWListsRef.current.delete(listType);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Хелперы для работы со списком участников
  const listApiType = (): BWListType => form.isPrivate ? 'whiteList' : 'blackList';
  const currentList  = form.isPrivate ? whitelist : blacklist;
  const setCurrentList = form.isPrivate
    ? (fn: (prev: IWhitelistUser[]) => IWhitelistUser[]) => setWhitelist(fn)
    : (fn: (prev: IWhitelistUser[]) => IWhitelistUser[]) => setBlacklist(fn);

  const handleAddToList = async (users: IWhitelistUser[]) => {
    if (isEditing && id) {
      try {
        await addToBWList(listApiType(), id, users.map(u => u.accountId));
      } catch { return; }
    }
    setCurrentList(prev => [...prev, ...users]);
  };

  const handleRemoveFromList = async (accountId: string) => {
    if (isEditing && id) {
      try {
        await removeFromBWList(listApiType(), id, accountId);
      } catch { return; }
    }
    setCurrentList(prev => prev.filter(x => x.accountId !== accountId));
  };

  // Чипы выбранных типов (включая все типы выбранных категорий)
  const selectedTypeObjects = useMemo(() => allTypes.filter(t =>
    selectedTypes.includes(t.id) || selectedCategories.includes(t.eventCategoryId),
  ), [allTypes, selectedTypes, selectedCategories]);

  const resolvedTypeIds = useMemo(() => [
    ...new Set([
      ...allTypes.filter(t => selectedCategories.includes(t.eventCategoryId)).map(t => t.id),
      ...selectedTypes,
    ]),
  ], [allTypes, selectedCategories, selectedTypes]);

  const getTypeColor = (t: IEventType) => t.eventCategory?.color ?? '#6366f1';

  const previewCoverBg = useMemo(
    () => buildEventCoverBackground(
      'create-preview',
      [...new Set(selectedTypeObjects.map(t => getTypeColor(t)))],
    ),
    [selectedTypeObjects],
  );

  const handleRemoveTypeChip = (typeId: string) => {
    if (selectedTypes.includes(typeId)) {
      setSelectedTypes(p => p.filter(x => x !== typeId));
      return;
    }
    const type = allTypes.find(t => t.id === typeId);
    if (!type || !selectedCategories.includes(type.eventCategoryId)) return;
    const catId = type.eventCategoryId;
    setSelectedCategories(p => p.filter(x => x !== catId));
    const otherTypeIds = allTypes
      .filter(t => t.eventCategoryId === catId && t.id !== typeId)
      .map(t => t.id);
    setSelectedTypes(p => [...new Set([...p, ...otherTypeIds])]);
  };

  const maxStartDate = tariffValidator?.createDateMaxPeriod != null
    ? addDaysLocalDateString(tariffValidator.createDateMaxPeriod)
    : null;

  const startDateParsed = (form.startDate && form.startTime)
    ? new Date(`${form.startDate}T${form.startTime}`)
    : null;
  const startDateIsInvalid = Boolean(
    form.startDate && form.startTime && startDateParsed && isNaN(startDateParsed.getTime()),
  );
  const todayIso = todayLocalDateString();

  const startDateTimeFieldError = ((): string | undefined => {
    if (!hasErr('startDate') && !hasErr('startTime')) return undefined;
    if (!form.startDate || !form.startTime) return 'Укажите дату и время';
    if (startDateIsInvalid) return 'Некорректная дата или время начала';
    if (maxStartDate && form.startDate > maxStartDate) {
      return `Дата начала не может быть позднее ${formatLocalDateLongRu(maxStartDate)}`;
    }
    if (!isEditing && form.startDate < todayIso) return 'Некорректная дата начала';
    return 'Дата и время начала не могут быть в прошлом';
  })();

  const endDateTimeFieldError = ((): string | undefined => {
    if (!hasErr('endDate') && !hasErr('endTime')) return undefined;
    if (!form.endDate || !form.endTime) return 'Укажите дату и время';
    return 'Дата и время окончания не могут быть раньше начала';
  })();

  const startDateToastMessage = ((): string => {
    if (!form.startDate || !form.startTime) return 'Укажите дату и время начала';
    if (startDateIsInvalid) return 'Некорректная дата или время начала';
    if (maxStartDate && form.startDate > maxStartDate) {
      return `Дата начала не может быть позднее ${formatLocalDateLongRu(maxStartDate)}`;
    }
    if (!isEditing && form.startDate < todayIso) return 'Некорректная дата начала';
    return 'Дата и время начала не могут быть в прошлом';
  })();

  const endDateTimeToast = ((): string => {
    if (!form.endDate || !form.endTime) return 'Укажите дату и время окончания';
    return 'Дата и время окончания не могут быть раньше начала';
  })();

  // Проверки тарифа
  // Нет тарифа → только бесплатные, без лимита по людям, только 0+
  const tv = tariffValidator;
  const hasTariff        = !!tariff && !!tv;
  // null = нет ограничений (разрешено любое значение); число = максимально допустимое
  const maxCost      = tv?.costLimit    ?? null;
  const maxPersons   = tv?.personsLimit ?? null;
  const tariffAgeLimit = tv?.ageLimit ?? null;
  /** Макс. ценз события по тарифу; null = любой возраст; без тарифа → 0 */
  const maxEventAge = useMemo(
    () => (tariffReady ? getMaxEventAgeForTariff(tariffAgeLimit, hasTariff) : null),
    [tariffReady, tariffAgeLimit, hasTariff],
  );
  /** Без тарифа — потолок 0 ₽; с тарифом — costLimit (null = без лимита) */
  const effectiveMaxCost = !hasTariff ? 0 : maxCost;
  const canSetCost       = tariffReady && (effectiveMaxCost === null || effectiveMaxCost > 0);
  const canSetMaxPersons = !hasTariff || maxPersons === null || maxPersons > 0;
  /** Нет тарифа или в тарифе только 0+ — поле возраста фиксируем */
  const ageFixedToZero   = tariffReady && maxEventAge === 0;
  const canSetAge        = tariffReady && (maxEventAge === null || maxEventAge > 0);
  const canSetPrivate    = hasTariff ? !!tv!.allowPrivate : false;
  const canSetGender     = hasTariff ? !!tv!.allowGenderSegregation : false;
  const hasTariffWarning = hasWallet && (!canSetPrivate || !canSetGender);
  const tariffName       = tariff?.name ?? 'текущем';

  // Стоимость: без тарифа / costLimit 0 → всегда 0
  useEffect(() => {
    if (!tariffReady || canSetCost) return;
    if (form.cost !== '0') setForm(f => ({ ...f, cost: '0' }));
  }, [tariffReady, canSetCost, form.cost]);

  useEffect(() => {
    if (loading || !tariffReady) return;
    // Только 0+ — прописываем 0 и на создании, и на редактировании
    if (ageFixedToZero) {
      if (form.ageLimit !== '0') setForm(f => ({ ...f, ageLimit: '0' }));
      return;
    }
    // На редактировании не затираем сохранённый ценз под более мягкий лимит
    if (isEditing || form.ageLimit === '') return;
    const age = parseInt(form.ageLimit, 10);
    if (!Number.isFinite(age)) return;
    if (maxEventAge != null && age > maxEventAge) {
      setForm(f => ({ ...f, ageLimit: String(maxEventAge) }));
    }
  }, [isEditing, ageFixedToZero, maxEventAge, tariffReady, loading, form.ageLimit]);

  const parseAgeLimit = (): number | null => {
    if (ageFixedToZero) return 0;
    if (form.ageLimit === '') return null;
    const age = parseInt(form.ageLimit, 10);
    return Number.isNaN(age) ? null : age;
  };

  const ageLimitHint = (() => {
    if (!tariffReady) return undefined;
    if (ageFixedToZero) {
      return hasTariff
        ? 'По тарифу доступен только рейтинг 0+'
        : 'Без тарифа доступен только рейтинг 0+';
    }
    if (maxEventAge == null) return 'любой возрастной рейтинг';
    return `можно указать рейтинг не выше ${maxEventAge}+`;
  })();

  const ageLimitErrorHint = (() => {
    if (!form.ageLimit) return undefined;
    if (maxEventAge == null) return 'Недопустимое значение';
    if (maxEventAge === 0) return 'По тарифу доступен только рейтинг 0+';
    return `Превышает лимит тарифа (макс. ${maxEventAge}+)`;
  })();

  const ageLimitToastMessage = !form.ageLimit
    ? 'Укажите возрастной рейтинг'
    : maxEventAge == null
      ? 'Недопустимый возрастной рейтинг'
      : maxEventAge === 0
        ? 'По тарифу доступен только рейтинг 0+'
        : `Возрастной рейтинг превышает лимит тарифа (макс. ${maxEventAge}+)`;

  const costToastMessage = parseFloat(form.cost) < 0
    ? 'Стоимость не может быть отрицательной'
    : effectiveMaxCost === 0
      ? (hasTariff
        ? 'По тарифу доступны только бесплатные мероприятия'
        : 'Без тарифа стоимость может быть только 0 ₽')
      : `Стоимость превышает лимит тарифа (до ${effectiveMaxCost?.toLocaleString()} ₽)`;

  // Validation
  const validate = (): FieldError | null => {
    const errs = new Set<FieldError>();
    if (!form.name.trim()) errs.add('name');
    if (typeCount === 0)   errs.add('type');
    if (!form.address.trim() || lat === null || lng === null) errs.add('location');
    if (!form.startDate)   errs.add('startDate');
    if (!form.startTime)   errs.add('startTime');
    if (form.startDate && form.startTime) {
      const start = new Date(`${form.startDate}T${form.startTime}`);
      if (isNaN(start.getTime())) {
        errs.add('startDate');
      } else if (!isEditing && start.getTime() < Date.now()) {
        errs.add('startDate');
      }
    }
    if (form.startDate && maxStartDate && form.startDate > maxStartDate) {
      errs.add('startDate');
    }
    if (endMode === 'duration') {
      const dh = parseInt(durationH) || 0;
      const dm = parseInt(durationM) || 0;
      if (dh === 0 && dm === 0) errs.add('duration');
    }
    if (endMode === 'multiday') {
      if (!form.endDate) errs.add('endDate');
      if (!form.endTime) errs.add('endTime');
      if (form.startDate && form.startTime && form.endDate && form.endTime) {
        const start = new Date(`${form.startDate}T${form.startTime}`);
        const end   = new Date(`${form.endDate}T${form.endTime}`);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end.getTime() < start.getTime()) {
          errs.add('endDate');
        }
      }
    }
    // Проверяем отрицательные значения
    if (form.cost && parseFloat(form.cost) < 0)                                           errs.add('cost');
    if (form.maxPersons && parseInt(form.maxPersons) < 0)                                 errs.add('maxPersons');
    // Возраст: если зафиксирован 0+ — не требуем ручного выбора
    if (hasWallet && tariffReady && !ageFixedToZero) {
      if (!form.ageLimit) {
        errs.add('ageLimit');
      } else {
        const age = parseInt(form.ageLimit, 10);
        if (Number.isNaN(age) || age < 0 || !isEventAgeAllowed(age, tariffAgeLimit, hasTariff)) {
          errs.add('ageLimit');
        }
      }
    }
    // Ограничения тарифа / отсутствие тарифа (effectiveMaxCost = 0 без тарифа)
    if (effectiveMaxCost != null && parseFloat(form.cost || '0') > effectiveMaxCost)      errs.add('cost');
    if (maxPersons != null && form.maxPersons && parseInt(form.maxPersons) > maxPersons)  errs.add('maxPersons');

    setFieldErrors(errs);
    if (!errs.size) return null;
    return (['name','type','location','startDate','startTime','duration','endDate','endTime','cost','maxPersons','ageLimit'] as FieldError[])
      .find(f => errs.has(f)) ?? null;
  };

  const scrollTo = (err: FieldError) => {
    const map: Partial<Record<FieldError, React.RefObject<HTMLElement | null>>> = {
      name: nameRef, type: typeRef, location: locationRef,
      startDate: startDateRef, startTime: startTimeRef,
      duration: durationRef,
      endDate: endDateRef, endTime: endTimeRef,
    };
    const el = map[err]?.current;
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  };

  const draftBlackListIds = useMemo(
    () => blacklist.map(u => u.accountId),
    [blacklist],
  );
  const draftWhiteListIds = useMemo(
    () => whitelist.map(u => u.accountId),
    [whitelist],
  );

  /** Частное + пустой белый список: только ручной выбор; иначе доступно «пригласить всех» */
  const canInviteAllSubscribers = !form.isPrivate || draftWhiteListIds.length > 0;

  useEffect(() => {
    if (!canInviteAllSubscribers && autoInviteMode === 'all') {
      setAutoInviteMode('select');
    }
  }, [canInviteAllSubscribers, autoInviteMode]);

  useEffect(() => {
    if (!autoInviteEnabled || autoInviteMode !== 'select') return;
    const blackSet = new Set(draftBlackListIds);
    const whiteSet = new Set(draftWhiteListIds);
    setInviteUserIds(prev => {
      const next = prev.filter(id => canInviteSubscriber(form.isPrivate, id, blackSet, whiteSet));
      return next.length === prev.length ? prev : next;
    });
  }, [autoInviteEnabled, autoInviteMode, form.isPrivate, draftBlackListIds, draftWhiteListIds]);

  useEffect(() => {
    if (!autoInviteEnabled) setInviteUserIds([]);
  }, [autoInviteEnabled]);

  const handleSubmit = async () => {
    const firstErr = validate();
    if (firstErr) {
      showToast({ name:'Укажите название', type:'Выберите тип мероприятия',
        location:'Укажите адрес на карте',
        startDate: startDateToastMessage,
        startTime:'Укажите время начала', duration:'Укажите длительность',
        endDate: endDateTimeToast, endTime:'Укажите время окончания',
        cost: costToastMessage,
        maxPersons: parseInt(form.maxPersons) < 0 ? 'Количество участников не может быть отрицательным' : `Кол-во участников превышает лимит тарифа (до ${maxPersons})`,
        ageLimit: ageLimitToastMessage,
      }[firstErr]);
      scrollTo(firstErr); return;
    }
    setSaving(true);
    try {
      const startTime = localPartsToApiIso(form.startDate, form.startTime);
      const endTime = endMode === 'duration'
        ? new Date(new Date(`${form.startDate}T${form.startTime}`).getTime()
          + (parseInt(durationH) || 0) * 3600000
          + (parseInt(durationM) || 0) * 60000).toISOString()
        : localPartsToApiIso(form.endDate, form.endTime);

      if (isEditing) {
        await apiClient.put(`/api/events/update/${id}`, {
          name: form.name, description: form.description || undefined,
          address: form.address, startTime, endTime, active: true,
          ...(lat !== null && lng !== null ? { latitude: lat, longitude: lng } : {}),
          ...(coverUrl ? { coverUrl } : {}),
          ...(coverImageId ? { coverImageId } : {}),
        });
        const editCost = parseFloat(form.cost) || 0;
        await assignEventParameters(id!, {
          cost:               editCost,
          private:            form.isPrivate,
          maxPersonsCount:    form.maxPersons ? parseInt(form.maxPersons) : null,
          ageLimit:           parseAgeLimit(),
          allowedGender:      form.allowedGender || null,
          allowUsersToInvite: form.allowUsersToInvite,
          ticketsEnabled:     canEnableTickets && editCost > 0 && form.ticketsEnabled,
        });
        await assignEventTypes(id!, resolvedTypeIds);
        navigate(`/event/${id}`);
      } else {
        const accountId = await getOrFetchAccountId();
        const createPayload = await buildCreateEventPayload({
          accountId,
          startTime,
          endTime,
          includeInvites: true,
        });

        const createResult = await apiClient.post<string>('/api/events/create', createPayload);
        const newEventId = createResult?.result ?? createResult as unknown as string;
        try {
          await createConversation({ name: 'обсуждения', eventId: newEventId });
        } catch {
          /* не блокируем публикацию, если обсуждение не создалось */
        }
        navigate('/my-events');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally { setSaving(false); }
  };

  /** Собирает тело CreateEventRequest из текущей формы (для create и шаблона) */
  const buildCreateEventPayload = async (opts: {
    accountId?: string;
    startTime?: string;
    endTime?: string;
    includeInvites?: boolean;
  } = {}): Promise<ICreateEventPayload> => {
    const accountId = opts.accountId ?? await getOrFetchAccountId();
    const createCost = parseFloat(form.cost) || 0;
    const startTime = opts.startTime
      ?? (form.startDate && form.startTime
        ? localPartsToApiIso(form.startDate, form.startTime)
        : undefined);
    const endTime = opts.endTime ?? (
      form.startDate && form.startTime
        ? (endMode === 'duration'
          ? new Date(new Date(`${form.startDate}T${form.startTime}`).getTime()
            + (parseInt(durationH) || 0) * 3600000
            + (parseInt(durationM) || 0) * 60000).toISOString()
          : (form.endDate && form.endTime ? localPartsToApiIso(form.endDate, form.endTime) : undefined))
        : undefined
    );

    const payload: ICreateEventPayload = {
      event: {
        name: form.name,
        description: form.description || undefined,
        address: form.address || undefined,
        ...(lat !== null && lng !== null ? { latitude: lat, longitude: lng } : {}),
        ...(startTime ? { startTime } : {}),
        ...(endTime ? { endTime } : {}),
        active: true,
        ...(coverUrl ? { coverUrl } : {}),
        ...(coverImageId ? { coverImageId } : {}),
      },
      eventParameters: {
        cost: createCost,
        private: form.isPrivate,
        maxPersonsCount: form.maxPersons ? parseInt(form.maxPersons) : undefined,
        ageLimit: parseAgeLimit() ?? undefined,
        allowedGender: form.allowedGender || undefined,
        allowUsersToInvite: form.allowUsersToInvite,
        ticketsEnabled: canEnableTickets && createCost > 0 && form.ticketsEnabled,
      },
      eventTypes: resolvedTypeIds,
      organizatorAccountIds:
        eventHost?.kind === 'organization' ? [] : [accountId],
      organizatorOrganizationIds:
        eventHost?.kind === 'organization'
          ? [eventHost.organizationId]
          : null,
    };

    if (form.isPrivate) {
      if (draftWhiteListIds.length > 0) {
        payload.whiteList = draftWhiteListIds;
        payload.WhiteList = draftWhiteListIds;
      }
    } else if (draftBlackListIds.length > 0) {
      payload.blackList = draftBlackListIds;
      payload.BlackList = draftBlackListIds;
    }

    if (opts.includeInvites && autoInviteEnabled) {
      if (autoInviteMode === 'all') {
        payload.inviteAllSubscribers = true;
        payload.InviteAllSubscribers = true;
      } else if (inviteUserIds.length > 0) {
        payload.inviteUsers = inviteUserIds;
        payload.InviteUsers = inviteUserIds;
      }
    }

    return payload;
  };

  const openSaveTemplate = () => {
    const defaultName = form.name.trim()
      ? `Шаблон: ${form.name.trim()}`
      : 'Новый шаблон';
    setOverwriteConfirmOpen(false);
    setSavingTemplate(false);

    const orgId = eventHost?.kind === 'organization' ? eventHost.organizationId : undefined;
    void searchEventTemplates(orgId ? { organizationId: orgId } : {})
      .then(list => {
        setExistingTemplates(list);
        if (sourceTemplate && list.some(t => t.id === sourceTemplate.id)) {
          setSaveTemplateMode('update');
          setUpdateTemplateId(sourceTemplate.id);
          setTemplateNameDraft(sourceTemplate.name);
        } else if (sourceTemplate) {
          setSaveTemplateMode('update');
          setUpdateTemplateId(sourceTemplate.id);
          setTemplateNameDraft(sourceTemplate.name);
          setExistingTemplates(prev => (
            prev.some(t => t.id === sourceTemplate.id) ? prev : [sourceTemplate, ...prev]
          ));
        } else {
          setSaveTemplateMode('new');
          setUpdateTemplateId(list[0]?.id ?? null);
          setTemplateNameDraft(defaultName);
        }
        setSaveTemplateOpen(true);
      })
      .catch(() => {
        setExistingTemplates(sourceTemplate ? [sourceTemplate] : []);
        if (sourceTemplate) {
          setSaveTemplateMode('update');
          setUpdateTemplateId(sourceTemplate.id);
          setTemplateNameDraft(sourceTemplate.name);
        } else {
          setSaveTemplateMode('new');
          setUpdateTemplateId(null);
          setTemplateNameDraft(defaultName);
        }
        setSaveTemplateOpen(true);
      });
  };

  const persistTemplate = async (mode: 'new' | 'update') => {
    const name = templateNameDraft.trim();
    if (!name) {
      showToast('Укажите название шаблона');
      return;
    }
    if (!form.name.trim() && resolvedTypeIds.length === 0 && !form.address.trim()) {
      showToast('Заполните хотя бы название, тип или место');
      return;
    }
    if (mode === 'update' && !updateTemplateId) {
      showToast('Выберите шаблон для обновления');
      return;
    }

    setSavingTemplate(true);
    try {
      const templateBody = await buildCreateEventPayload({ includeInvites: true });
      if (mode === 'update' && updateTemplateId) {
        await updateEventTemplate(updateTemplateId, { name, templateBody });
        setSourceTemplate(prev => (
          prev && prev.id === updateTemplateId
            ? { ...prev, name, templateBody, updateDate: new Date().toISOString() }
            : { id: updateTemplateId, name, templateBody, ownerAccountId: null, ownerOrganizationId: null, createDate: null, updateDate: new Date().toISOString() }
        ));
        showToast('Шаблон обновлён');
      } else {
        const newId = await createEventTemplate({
          name,
          templateBody,
          organizationId:
            eventHost?.kind === 'organization' ? eventHost.organizationId : null,
        });
        setSourceTemplate({
          id: newId,
          name,
          templateBody,
          ownerAccountId: null,
          ownerOrganizationId: eventHost?.kind === 'organization' ? eventHost.organizationId : null,
          createDate: new Date().toISOString(),
          updateDate: null,
        });
        showToast('Шаблон сохранён');
      }
      setOverwriteConfirmOpen(false);
      setSaveTemplateOpen(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Не удалось сохранить шаблон');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSaveTemplate = () => {
    const name = templateNameDraft.trim();
    if (!name) {
      showToast('Укажите название шаблона');
      return;
    }
    if (saveTemplateMode === 'update') {
      if (!updateTemplateId) {
        showToast('Выберите шаблон для обновления');
        return;
      }
      setOverwriteConfirmOpen(true);
      return;
    }
    void persistTemplate('new');
  };

  const [confirmOpen, setConfirmOpen] = useState(false);

  const wantsTicketsEnabled = canEnableTickets
    && (parseFloat(form.cost) || 0) > 0
    && form.ticketsEnabled;

  /** Проверка актуальности оферты / соглашения на билеты перед действием */
  const ensureOrgAgreements = useCallback(async (
    resume: 'publish' | 'enableTickets',
    opts: { requireOffer: boolean; requireTicketing: boolean },
  ): Promise<boolean> => {
    if (!eventHost || eventHost.kind !== 'organization') return true;

    setCheckingOrgAgreements(true);
    try {
      const { outdated, missingDocs } = await collectOutdatedOrgAgreements(
        eventHost.organizationId,
        {
          requireOffer: opts.requireOffer,
          requireTicketing: opts.requireTicketing,
        },
      );

      if (missingDocs.length > 0) {
        showToast(orgAgreementMissingMessage(missingDocs[0]));
        return false;
      }
      if (outdated.length > 0) {
        setOrgAgreementQueue(outdated);
        setOrgAgreementResume(resume);
        return false;
      }
      return true;
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Не удалось проверить соглашения организации');
      return false;
    } finally {
      setCheckingOrgAgreements(false);
    }
  }, [eventHost, showToast]);

  const handlePublishClick = () => {
    void (async () => {
      if (!isEditing) {
        const firstErr = validate();
        if (firstErr) {
          showToast({ name:'Укажите название', type:'Выберите тип мероприятия',
            location:'Укажите адрес на карте',
            startDate: startDateToastMessage,
            startTime:'Укажите время начала', duration:'Укажите длительность',
            endDate: endDateTimeToast, endTime:'Укажите время окончания',
            cost: costToastMessage,
            maxPersons: parseInt(form.maxPersons) < 0 ? 'Количество участников не может быть отрицательным' : `Кол-во участников превышает лимит тарифа (до ${maxPersons})`,
            ageLimit: ageLimitToastMessage,
          }[firstErr]);
          scrollTo(firstErr);
          return;
        }
      }

      if (isEditing && !eventHost && editTicketsCapability === 'unknown') {
        showToast('Загрузка данных организатора...');
        return;
      }

      if (eventHost?.kind === 'organization') {
        const ok = await ensureOrgAgreements('publish', {
          requireOffer: true,
          requireTicketing: wantsTicketsEnabled,
        });
        if (!ok) return;
      }

      if (isEditing) {
        void handleSubmit();
        return;
      }
      setConfirmOpen(true);
    })();
  };

  const handleTicketsToggle = (enabled: boolean) => {
    if (!enabled) {
      setForm(f => ({ ...f, ticketsEnabled: false }));
      return;
    }
    void (async () => {
      if (eventHost?.kind === 'organization') {
        const ok = await ensureOrgAgreements('enableTickets', {
          requireOffer: false,
          requireTicketing: true,
        });
        if (!ok) return;
      }
      setForm(f => ({ ...f, ticketsEnabled: true }));
    })();
  };

  const handleOrgAgreementsComplete = () => {
    const resume = orgAgreementResume;
    setOrgAgreementQueue([]);
    setOrgAgreementResume(null);
    if (resume === 'enableTickets') {
      setForm(f => ({ ...f, ticketsEnabled: true }));
      return;
    }
    if (resume === 'publish') {
      if (isEditing) {
        void handleSubmit();
      } else {
        setConfirmOpen(true);
      }
    }
  };
  const checks = [
    { label: 'Название',          done: !!form.name.trim() },
    { label: 'Тип мероприятия',   done: typeCount > 0 },
    { label: 'Место на карте',    done: !!form.address && lat !== null },
    { label: 'Дата и время',      done: !!form.startDate && !!form.startTime },
    { label: 'Обложка',           done: !!(coverUrl || coverImageId), optional: true },
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

  if (!isEditing && hostGate === 'checking') {
    return (
      <div className={styles.page}>
        <div className={styles.pageInner}>
          <div className={styles.card} style={{ gridColumn: '1 / -1' }}>
            <div className={styles.header}>
              <HeroBackButton onClick={goBack} />
              <h1 className={styles.title}>Новое событие</h1>
            </div>
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Загрузка...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isEditing && hostGate === 'chooser') {
    return (
      <div className={styles.page}>
        <CreateEventHostChooser
          onContinue={(host, template) => {
            templateAppliedRef.current = false;
            setPendingTemplate(template);
            setEventHost(host);
            setCanChooseHost(true);
            setHostGate('form');
            if (host.kind === 'organization') {
              setSearchParams(
                { host: 'org', organizationId: host.organizationId },
                { replace: true },
              );
            } else {
              setSearchParams({ host: 'user' }, { replace: true });
            }
          }}
        />
      </div>
    );
  }

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
          <HeroBackButton onClick={() => {
            if (!isEditing && canChooseHost) {
              skipHostGateEffectRef.current = true;
              setEventHost(null);
              setPendingTemplate(null);
              setSourceTemplate(null);
              templateAppliedRef.current = false;
              setHostGate('chooser');
              setSearchParams({}, { replace: true });
              return;
            }
            goBack();
          }} />
          <div>
            <h1 className={styles.title}>{isEditing ? 'Редактировать мероприятие' : 'Новое мероприятие'}</h1>
            {eventHost?.kind === 'organization' && (
              <div className={styles.hostBadge}>
                от имени «{eventHost.organizationName}»
              </div>
            )}
          </div>
        </div>

        {/* Обложка */}
        <Section title="Обложка">
          <CoverUpload
            currentUrl={coverUrl}
            currentFileId={coverImageId}
            onUploaded={(url, fileId) => {
              setCoverUrl(url);
              setCoverImageId(fileId);
            }}
          />
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
                  <EventTypeChip
                    key={t.id}
                    type={t}
                    className={styles.typeChip}
                    iconSize={14}
                    onRemove={() => handleRemoveTypeChip(t.id)}
                  />
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
          {/* Переключатель режима — скрываем если тариф не разрешает многодневные */}
          {tariffValidator?.allowMultidaysEvent !== false && (
            <div className={styles.endModeToggle}>
              <button className={`${styles.modeBtn} ${endMode === 'duration' ? styles.modeBtnActive : ''}`}
                onClick={() => setEndMode('duration')}>По длительности</button>
              <button className={`${styles.modeBtn} ${endMode === 'multiday' ? styles.modeBtnActive : ''}`}
                onClick={() => { if (tariffValidator?.allowMultidaysEvent === false) return; setEndMode('multiday'); }}>
                Многодневное
              </button>
            </div>
          )}

          {/* Две колонки */}
          <div className={endMode === 'duration' ? styles.dateRow : styles.dateRowEqual}>
            {/* Левая — всегда дата начала */}
            <Field label="Начало *" error={startDateTimeFieldError}>
              <div ref={startDateRef as any}>
                <DatePicker
                  withTime
                  value={form.startDate && form.startTime ? `${form.startDate}T${form.startTime}` : form.startDate}
                  onChange={iso => {
                    if (!iso) {
                      setForm(f => ({ ...f, startDate: '', startTime: '' }));
                      return;
                    }
                    // Берём компоненты из ISO-строки, а не из Date — иначе год вроде 0101
                    // парсится непредсказуемо и форма снова выглядит «пустой».
                    const date = iso.slice(0, 10);
                    const time = iso.includes('T') ? iso.slice(11, 16) : '';
                    setForm(f => ({
                      ...f,
                      startDate: date,
                      startTime: time || f.startTime,
                    }));
                    setFieldErrors(p => { const n = new Set(p); n.delete('startDate'); n.delete('startTime'); return n; });
                  }}
                  placeholder="Дата и время начала"
                  hasError={hasErr('startDate') || hasErr('startTime')}
                  min={!isEditing ? todayLocalDateString() : undefined}
                  max={maxStartDate ?? undefined}
                />
              </div>
            </Field>

            {/* Правая — длительность или дата окончания */}
            {endMode === 'duration' ? (
              <Field label="Длительность *" error={hasErr('duration') ? 'Укажите длительность' : undefined}>
                <div ref={durationRef}>
                  <DurationPicker
                    hours={parseInt(durationH) || 0}
                    minutes={parseInt(durationM) || 0}
                    hasError={hasErr('duration')}
                    onChangeHours={h => {
                      setDurationH(String(h));
                      setFieldErrors(p => { const n = new Set(p); n.delete('duration'); return n; });
                    }}
                    onChangeMinutes={m => {
                      setDurationM(String(m));
                      setFieldErrors(p => { const n = new Set(p); n.delete('duration'); return n; });
                    }}
                  />
                </div>
              </Field>
            ) : (
              <Field label="Окончание *" error={endDateTimeFieldError}>
                <div ref={endDateRef as any}>
                  <DatePicker
                    withTime
                    value={form.endDate && form.endTime ? `${form.endDate}T${form.endTime}` : form.endDate}
                    onChange={iso => {
                      if (!iso) {
                        setForm(f => ({ ...f, endDate: '', endTime: '' }));
                        return;
                      }
                      const date = iso.slice(0, 10);
                      const time = iso.includes('T') ? iso.slice(11, 16) : '';
                      setForm(f => ({
                        ...f,
                        endDate: date,
                        endTime: time || f.endTime,
                      }));
                      setFieldErrors(p => { const n = new Set(p); n.delete('endDate'); n.delete('endTime'); return n; });
                    }}
                    placeholder="Дата и время окончания"
                    hasError={hasErr('endDate') || hasErr('endTime')}
                    min={form.startDate || todayLocalDateString()}
                    minTime={form.startDate && form.endDate && form.startDate === form.endDate ? form.startTime : undefined}
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
                  onChange={e => { const v = e.target.value.replace(/[^0-9.,]/g, ''); setForm(f => ({ ...f, cost: v })); }}
                  type="number" min="0"
                  hasError={hasErr('cost')}
                  hint={hasErr('cost')
                    ? (effectiveMaxCost === 0
                      ? (hasTariff
                        ? 'По тарифу доступны только бесплатные мероприятия'
                        : 'Без тарифа стоимость может быть только 0 ₽')
                      : `Превышает лимит тарифа (до ${effectiveMaxCost?.toLocaleString()} ₽)`)
                    : canSetCost && effectiveMaxCost != null
                    ? `до ${effectiveMaxCost.toLocaleString()} ₽`
                    : !canSetCost
                    ? (hasTariff ? 'Недоступно в тарифе' : 'Без тарифа — только бесплатные')
                    : undefined}
                />
              </Field>
              <Field label="Макс. участников">
                <LockedInput
                  locked={!canSetMaxPersons}
                  value={form.maxPersons} placeholder="∞"
                  onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); setForm(f => ({ ...f, maxPersons: v })); }}
                  type="number" min="0"
                  hasError={hasErr('maxPersons')}
                  hint={hasErr('maxPersons')
                    ? `Превышает лимит тарифа (до ${maxPersons})`
                    : !canSetMaxPersons
                    ? 'Недоступно в тарифе — только без лимита'
                    : maxPersons ? `до ${maxPersons} человек` : undefined}
                />
              </Field>
            </div>

            <Field
              label={canSetAge ? 'Возрастной рейтинг *' : 'Возрастной рейтинг'}
              error={hasErr('ageLimit') ? (!form.ageLimit ? 'Обязательное поле' : 'Недопустимое значение') : undefined}
            >
              <LockedInput
                locked={!canSetAge}
                value={ageFixedToZero ? '0' : form.ageLimit}
                placeholder={ageFixedToZero ? '0' : 'например 18'}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9]/g, '');
                  setForm(f => ({ ...f, ageLimit: v }));
                  setFieldErrors(p => { const n = new Set(p); n.delete('ageLimit'); return n; });
                }}
                type="number"
                min="0"
                max={maxEventAge != null ? String(maxEventAge) : undefined}
                inputMode="numeric"
                hasError={hasErr('ageLimit')}
                suffix={(ageFixedToZero || form.ageLimit !== '') ? '+' : undefined}
                hint={hasErr('ageLimit') ? ageLimitErrorHint : ageLimitHint}
              />
            </Field>

            <div className={styles.toggles}>
              <Toggle
                label="Приватное мероприятие"
                checked={form.isPrivate}
                locked={!canSetPrivate}
                onChange={v => {
                  setForm(f => ({ ...f, isPrivate: v }));
                  if (isEditing) ensureBWListLoaded(v ? 'whiteList' : 'blackList');
                }}
                lockedHint="Недоступно в тарифе"
              />
              <Toggle
                label="Фильтр участников по полу"
                checked={form.allowedGender !== ''}
                locked={!canSetGender}
                onChange={v => setForm(f => ({ ...f, allowedGender: v ? 'Male' : '' }))}
                lockedHint="Недоступно в тарифе"
              />
              {form.allowedGender !== '' && canSetGender && (
                <div className={styles.genderPicker}>
                  {(['Male', 'Female'] as const).map(g => (
                    <button
                      key={g}
                      type="button"
                      className={`${styles.genderBtn} ${form.allowedGender === g ? styles.genderBtnActive : ''}`}
                      onClick={() => setForm(f => ({ ...f, allowedGender: g }))}
                    >
                      {g === 'Male' ? 'Мужской' : 'Женский'}
                    </button>
                  ))}
                </div>
              )}
              <Toggle
                label="Участники могут приглашать"
                checked={form.allowUsersToInvite}
                onChange={v => setForm(f => ({ ...f, allowUsersToInvite: v }))}
              />
              {canEnableTickets && (
                <Toggle
                  label="Продажа билетов"
                  checked={form.ticketsEnabled}
                  locked={(parseFloat(form.cost) || 0) <= 0 || checkingOrgAgreements}
                  onChange={handleTicketsToggle}
                  lockedHint={
                    (parseFloat(form.cost) || 0) <= 0
                      ? 'Укажите стоимость больше 0 ₽'
                      : 'Проверка соглашений...'
                  }
                />
              )}
            </div>

            {/* Список участников: чёрный (по умолчанию) или белый (для приватных) */}
            {(!form.isPrivate || canSetPrivate) && (
              <div className={styles.whitelist}>
                <div className={styles.whitelistHeader}>
                  <div className={styles.whitelistTitle}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    {form.isPrivate ? 'Белый список участников' : 'Чёрный список участников'}
                  </div>
                  <button className={styles.whitelistAdd} onClick={() => setListModalOpen(true)}>
                    + Добавить
                  </button>
                </div>
                <p className={styles.whitelistHint}>
                  {form.isPrivate
                    ? 'Только эти пользователи смогут записаться на мероприятие'
                    : 'Эти пользователи не смогут записаться на мероприятие'}
                </p>

                {currentList.length > 0 && (
                  <div className={styles.whitelistList}>
                    {currentList.map(u => {
                      const name = u.firstName ? `${u.firstName} ${u.lastName ?? ''}`.trim() : u.login;
                      const initials = u.firstName
                        ? `${u.firstName[0]}${u.lastName?.[0] ?? ''}`.toUpperCase()
                        : u.login[0]?.toUpperCase() ?? '?';
                      return (
                        <div key={u.accountId} className={styles.whitelistChip}>
                          <UserAvatar
                            accountId={u.accountId}
                            avatarId={u.avatarId ?? null}
                            initials={initials}
                            size={22}
                          />
                          <span className={styles.whitelistChipName}>{name}</span>
                          <span className={styles.whitelistChipLogin}>@{u.login}</span>
                          <button className={styles.whitelistChipRemove}
                            onClick={() => handleRemoveFromList(u.accountId)}>
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Section>
        )}

      </div>

      {/* ── Правая колонка: предпросмотр + кнопки ── */}
      <div className={styles.sidePanel}>

        {/* Карточка предпросмотра */}
        <div className={styles.previewCard}>
          <div
            className={styles.previewCover}
            style={!coverUrl && !coverImageId ? { background: previewCoverBg } : undefined}
          >
            {coverUrl ? (
              <img src={coverUrl} alt="Обложка" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : coverImageId ? (
              <AuthImage
                fileId={coverImageId}
                alt="Обложка"
                imageFit="cover"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <span className={styles.previewCoverEmpty}>нет обложки</span>
            )}
          </div>
          <div className={styles.previewBody}>
            {/* Типы мероприятия */}
            {selectedTypeObjects.length > 0 && (
              <div className={styles.previewTypes}>
                {selectedTypeObjects.slice(0, 3).map(t => (
                  <EventTypeChip
                    key={t.id}
                    type={t}
                    className={styles.previewTypeChip}
                    iconSize={10}
                  />
                ))}
                {selectedTypeObjects.length > 3 && (
                  <span className={styles.previewTypeChip} style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '0.5px solid var(--border)' }}>
                    +{selectedTypeObjects.length - 3}
                  </span>
                )}
              </div>
            )}
            <div className={styles.previewName}>{form.name || <span style={{color:'var(--text-muted)'}}>Название мероприятия</span>}</div>
            <div className={styles.previewBadges}>
              {form.isPrivate && <span className={styles.badgePrivate}>Приватное</span>}
              <span className={styles.badgeAge}>{resolveAgeLimitBadge(form.ageLimit)}</span>
            </div>
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
            {form.maxPersons && (
              <div className={styles.previewRow}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                до {form.maxPersons} участников
              </div>
            )}
            <div className={styles.previewPriceRow}>
              {parseFloat(form.cost) === 0
                ? <div className={styles.previewFree}>Бесплатно</div>
                : <div className={styles.previewCost}>{parseFloat(form.cost).toLocaleString('ru-RU')} ₽</div>}
            </div>
          </div>
        </div>

        {/* Чеклист */}
        <div className={styles.checklist}>
          <div className={styles.checklistTitle}>Готовность к публикации</div>
          {checks.map(c => (
            <div key={c.label}
              className={`${styles.checkRow} ${c.done ? styles.checkDone : c.optional ? styles.checkOptional : ''} ${c.label === 'Обложка' ? styles.checklistCoverRow : ''}`}>
              <div className={`${styles.checkDot} ${c.done ? styles.checkDotOk : c.optional ? styles.checkDotOpt : styles.checkDotNo}`}>
                {c.done ? '·' : c.optional ? '·' : '·'}
              </div>
              {c.label}{c.optional ? ' (необяз.)' : ''}
            </div>
          ))}
        </div>

        {/* Кнопки */}
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={goBack}>Отмена</button>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={handlePublishClick}
            disabled={saving || checkingOrgAgreements}
          >
            {saving || checkingOrgAgreements
              ? (checkingOrgAgreements ? 'Проверка...' : 'Сохранение...')
              : isEditing ? 'Сохранить' : 'Опубликовать'}
          </button>
        </div>
        <button
          type="button"
          className={styles.templateSaveBtn}
          onClick={openSaveTemplate}
          disabled={savingTemplate}
        >
          Сохранить как шаблон
        </button>
        {!isEditing && (
          <div className={styles.autoInviteBox}>
            <label className={styles.autoInviteToggle}>
              <input
                type="checkbox"
                checked={autoInviteEnabled}
                onChange={(e) => setAutoInviteEnabled(e.target.checked)}
              />
              <span>Автоприглашение</span>
            </label>
            <div className={`${styles.autoInviteModes} ${!autoInviteEnabled ? styles.autoInviteModesDisabled : ''}`}>
              <label
                className={`${styles.autoInviteRadio} ${!autoInviteEnabled || !canInviteAllSubscribers ? styles.autoInviteRadioDisabled : ''}`}
                title={
                  form.isPrivate && !canInviteAllSubscribers
                    ? 'Добавьте участников в белый список, чтобы пригласить всех сразу'
                    : undefined
                }
              >
                <input
                  type="radio"
                  name="autoInviteMode"
                  checked={autoInviteMode === 'all'}
                  disabled={!autoInviteEnabled || !canInviteAllSubscribers}
                  onChange={() => setAutoInviteMode('all')}
                />
                Пригласить всех подписчиков
              </label>
              <label className={styles.autoInviteRadio}>
                <input
                  type="radio"
                  name="autoInviteMode"
                  checked={autoInviteMode === 'select'}
                  disabled={!autoInviteEnabled}
                  onChange={() => setAutoInviteMode('select')}
                />
                Выбрать подписчиков
              </label>
            </div>
            {autoInviteEnabled && autoInviteMode === 'select' && accountId && (
              <button
                type="button"
                className={styles.pickInviteBtn}
                onClick={() => setInvitePickerOpen(true)}
              >
                {inviteUserIds.length > 0
                  ? `Выбрано подписчиков: ${inviteUserIds.length}`
                  : 'Выбрать подписчиков…'}
              </button>
            )}
          </div>
        )}
      </div>{/* end sidePanel */}
      </div>{/* end pageInner */}

      {/* Диалог подтверждения публикации */}
      {confirmOpen && (
        <div className={styles.confirmBackdrop} onClick={() => setConfirmOpen(false)}>
          <div className={styles.confirmDialog} onClick={e => e.stopPropagation()}>
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

      {invitePickerOpen && accountId && (
        <InviteModal
          pickMode
          currentAccountId={accountId}
          isPrivate={form.isPrivate}
          draftBlackListIds={draftBlackListIds}
          draftWhiteListIds={draftWhiteListIds}
          initialSelectedIds={inviteUserIds}
          onPickConfirm={setInviteUserIds}
          onClose={() => setInvitePickerOpen(false)}
        />
      )}

      {/* Список участников (чёрный или белый) */}
      {listModalOpen && accountId && (
        <WhitelistModal
          myAccountId={accountId}
          current={currentList}
          listType={form.isPrivate ? 'whitelist' : 'blacklist'}
          onAdd={handleAddToList}
          onClose={() => setListModalOpen(false)}
        />
      )}

      {saveTemplateOpen && (
        <div className={styles.templateOverlay} onClick={() => !savingTemplate && setSaveTemplateOpen(false)}>
          <div
            className={styles.templateDialog}
            role="dialog"
            aria-modal
            aria-label="Сохранить шаблон"
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.templateDialogTitle}>Сохранить как шаблон</div>
            <p className={styles.templateDialogHint}>
              Сохранится текущая форма
              {eventHost?.kind === 'organization'
                ? ` для организации «${eventHost.organizationName}»`
                : ' в ваши шаблоны'}
              , включая дату, время, приглашения и списки доступа.
            </p>

            <div className={styles.templateModeGroup} role="radiogroup" aria-label="Способ сохранения">
              <label className={styles.templateModeOption}>
                <input
                  type="radio"
                  name="saveTemplateMode"
                  checked={saveTemplateMode === 'new'}
                  onChange={() => {
                    setSaveTemplateMode('new');
                    if (!templateNameDraft.trim() || (sourceTemplate && templateNameDraft === sourceTemplate.name)) {
                      setTemplateNameDraft(
                        form.name.trim() ? `Шаблон: ${form.name.trim()}` : 'Новый шаблон',
                      );
                    }
                  }}
                />
                <span>Создать новый шаблон</span>
              </label>
              <label className={`${styles.templateModeOption} ${existingTemplates.length === 0 ? styles.templateModeOptionDisabled : ''}`}>
                <input
                  type="radio"
                  name="saveTemplateMode"
                  checked={saveTemplateMode === 'update'}
                  disabled={existingTemplates.length === 0}
                  onChange={() => {
                    setSaveTemplateMode('update');
                    const preferred = sourceTemplate
                      ?? existingTemplates.find(t => t.id === updateTemplateId)
                      ?? existingTemplates[0];
                    if (preferred) {
                      setUpdateTemplateId(preferred.id);
                      setTemplateNameDraft(preferred.name);
                    }
                  }}
                />
                <span>
                  {sourceTemplate
                    ? `Обновить «${sourceTemplate.name}»`
                    : 'Обновить существующий'}
                </span>
              </label>
            </div>

            {saveTemplateMode === 'update' && existingTemplates.length > 0 && (
              <select
                className={styles.input}
                value={updateTemplateId ?? ''}
                onChange={e => {
                  const id = e.target.value;
                  setUpdateTemplateId(id);
                  const found = existingTemplates.find(t => t.id === id);
                  if (found) setTemplateNameDraft(found.name);
                }}
              >
                {existingTemplates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {sourceTemplate?.id === t.id ? ' (текущий)' : ''}
                  </option>
                ))}
              </select>
            )}

            <input
              className={styles.input}
              value={templateNameDraft}
              onChange={e => setTemplateNameDraft(e.target.value)}
              placeholder="Название шаблона"
              autoFocus={saveTemplateMode === 'new'}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveTemplate();
              }}
            />
            <div className={styles.templateDialogActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                disabled={savingTemplate}
                onClick={() => setSaveTemplateOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className={styles.saveBtn}
                disabled={
                  savingTemplate
                  || !templateNameDraft.trim()
                  || (saveTemplateMode === 'update' && !updateTemplateId)
                }
                onClick={handleSaveTemplate}
              >
                {savingTemplate
                  ? 'Сохранение...'
                  : saveTemplateMode === 'update'
                    ? 'Обновить'
                    : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {overwriteConfirmOpen && (
        <div className={styles.templateOverlay} onClick={() => !savingTemplate && setOverwriteConfirmOpen(false)}>
          <div
            className={styles.templateDialog}
            role="dialog"
            aria-modal
            aria-label="Подтверждение перезаписи шаблона"
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.templateDialogTitle}>Перезаписать шаблон?</div>
            <p className={styles.templateDialogHint}>
              Шаблон «{templateNameDraft.trim() || 'без названия'}» будет заменён текущими данными формы.
              Это действие нельзя отменить.
            </p>
            <div className={styles.templateDialogActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                disabled={savingTemplate}
                onClick={() => setOverwriteConfirmOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className={styles.saveBtn}
                disabled={savingTemplate}
                onClick={() => { void persistTemplate('update'); }}
              >
                {savingTemplate ? 'Сохранение...' : 'Перезаписать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {orgAgreementQueue.length > 0 && eventHost?.kind === 'organization' && (
        <OrgAgreementAcceptDialog
          organizationId={eventHost.organizationId}
          organizationName={eventHost.organizationName}
          queue={orgAgreementQueue}
          onCancel={() => {
            setOrgAgreementQueue([]);
            setOrgAgreementResume(null);
          }}
          onComplete={handleOrgAgreementsComplete}
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

function LockedInput({ locked, hint, suffix, hasError, ...props }: {
  locked?: boolean; hint?: string; suffix?: string; hasError?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <div className={styles.lockedFieldRow}>
        <div className={`${styles.inputShell} ${locked ? styles.inputShellLocked : ''}`}>
          <input
            className={`${styles.input} ${styles.inputInShell} ${locked ? styles.inputLocked : ''} ${hasError ? styles.inputError : ''}`}
            disabled={locked} {...props}
            onFocus={e => (e.target as HTMLInputElement).select()} />
          {locked && <span className={styles.lockBadge}>тариф</span>}
        </div>
        {suffix && <span className={styles.inputSuffix}>{suffix}</span>}
      </div>
      {hint && <div className={`${styles.fieldHint} ${hasError ? styles.fieldHintErr : locked ? styles.fieldHintWarn : ''}`}>{hint}</div>}
    </div>
  );
}

function LockedSelect({ locked, hint, hasError, value, onChange, options, placeholder }: {
  locked?: boolean; hint?: string; hasError?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div>
      <div className={`${styles.inputShell} ${locked ? styles.inputShellLocked : ''}`}>
        <select
          className={`${styles.input} ${styles.inputInShell} ${styles.select} ${locked ? styles.inputLocked : ''} ${hasError ? styles.inputError : ''} ${!value ? styles.selectPlaceholder : ''}`}
          disabled={locked}
          value={value}
          onChange={e => onChange(e.target.value)}
        >
          {placeholder && (
            <option value="" disabled={value !== ''}>{placeholder}</option>
          )}
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {locked && <span className={styles.lockBadge}>тариф</span>}
      </div>
      {hint && <div className={`${styles.fieldHint} ${hasError ? styles.fieldHintErr : locked ? styles.fieldHintWarn : ''}`}>{hint}</div>}
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
