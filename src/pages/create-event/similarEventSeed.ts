// Перенос полей завершённого мероприятия в форму нового.
// Даты в семя не входят и при чтении сбрасываются.

import { fetchEventParameters } from '@/entities/event/eventExtrasApi';
import {
  fetchEventTypesByEvent,
  getBWList,
  type IBWListUser,
} from '@/entities/event/participationApi';
import {
  fetchEventTicketTypes,
  minActiveTicketTypePrice,
  ticketTypeDraftCloneForSeed,
} from '@/entities/event/ticketTypesApi';
import type { IEvent } from '@/entities/event/types';
import type { Gender } from '@/shared/api/types';
import { DEFAULT_COVER_FOCUS, coverFocusFromEvent } from '@/shared/lib/coverFocus';
import type { CreateEventHost } from './CreateEventHostChooser';
import {
  type CreateEventDraftForm,
  type CreateEventDraftSnapshot,
} from './createEventDraft';
import type { IWhitelistUser } from './WhitelistModal';

const STORAGE_KEY = 'elist_similar_event_seed';

export const SIMILAR_EVENT_FIELDS = [
  { id: 'cover', label: 'Обложка', column: 'left' },
  { id: 'title', label: 'Заголовок', column: 'left' },
  { id: 'description', label: 'Описание', column: 'left' },
  { id: 'eventType', label: 'Тип мероприятия', column: 'left' },
  { id: 'location', label: 'Местоположение', column: 'left' },
  { id: 'gender', label: 'Ограничение по полу', column: 'right' },
  { id: 'bwList', label: 'Черный/Белый список', column: 'right' },
  { id: 'cost', label: 'Стоимость / билеты', column: 'right' },
  { id: 'age', label: 'Возрастной рейтинг', column: 'right' },
  { id: 'participants', label: 'Кол-во участников', column: 'right' },
] as const;

export type SimilarEventField = (typeof SIMILAR_EVENT_FIELDS)[number]['id'];

const EMPTY_FORM: CreateEventDraftForm = {
  name: '',
  description: '',
  address: '',
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  cost: '0',
  ageLimit: '',
  isPrivate: false,
  maxPersons: '',
  allowUsersToInvite: true,
  allowedGender: '',
  ticketsEnabled: false,
};

function blankSnapshot(host: CreateEventHost): CreateEventDraftSnapshot {
  return {
    host,
    form: { ...EMPTY_FORM },
    lat: null,
    lng: null,
    coverImageId: null,
    coverUrl: null,
    coverFocus: { ...DEFAULT_COVER_FOCUS },
    selectedCategories: [],
    selectedTypes: [],
    endMode: 'duration',
    durationH: '2',
    durationM: '0',
    whitelist: [],
    blacklist: [],
    inviteUserIds: [],
    autoInviteEnabled: false,
    autoInviteMode: 'select',
    ticketTypes: [],
  };
}

function mapListUsers(items: IBWListUser[]): IWhitelistUser[] {
  return items.map(item => ({
    accountId: item.accountId,
    login: item.account?.login || item.accountId.slice(0, 8),
    firstName: item.personInfo?.firstName ?? null,
    lastName: item.personInfo?.lastName ?? null,
    avatarId: item.account?.avatarId ?? null,
  }));
}

function ageToForm(raw: number | null | undefined): string {
  if (raw == null || Number.isNaN(Number(raw))) return '';
  return String(Math.max(0, Math.trunc(Number(raw))));
}

/** Семя формы: только отмеченные поля, даты пустые. */
export async function buildSimilarEventSeed(input: {
  event: IEvent;
  selected: ReadonlySet<SimilarEventField>;
  host: CreateEventHost;
}): Promise<CreateEventDraftSnapshot> {
  const { event, selected, host } = input;
  const seed = blankSnapshot(host);
  const needsParams = (['gender', 'bwList', 'cost', 'age', 'participants'] as const)
    .some(id => selected.has(id));

  let params = event.parameters ?? null;
  if (needsParams && !params) {
    params = await fetchEventParameters(event.id).catch(() => null);
  }

  if (selected.has('title')) seed.form.name = event.name ?? '';
  if (selected.has('description')) seed.form.description = event.description ?? '';

  if (selected.has('location')) {
    seed.form.address = event.address ?? '';
    seed.lat = Number.isFinite(event.latitude) ? event.latitude : null;
    seed.lng = Number.isFinite(event.longitude) ? event.longitude : null;
  }

  if (selected.has('cover')) {
    seed.coverImageId = event.coverImageId ?? null;
    seed.coverUrl = event.coverUrl ?? null;
    seed.coverFocus = coverFocusFromEvent(event) ?? { ...DEFAULT_COVER_FOCUS };
  }

  if (selected.has('cost')) {
    const ticketsEnabled = Boolean(params?.ticketsEnabled);
    seed.form.ticketsEnabled = ticketsEnabled;
    if (ticketsEnabled) {
      const types = await fetchEventTicketTypes(event.id, true).catch(() => []);
      const activeOrAll = types.length > 0
        ? types.filter(t => t.active).concat(types.filter(t => !t.active))
        : types;
      // В семя — активные типы без server id; если активных нет — все (как снимок).
      const source = types.some(t => t.active) ? types.filter(t => t.active) : activeOrAll;
      seed.ticketTypes = source.map(ticketTypeDraftCloneForSeed);
      const minPrice = minActiveTicketTypePrice(seed.ticketTypes);
      seed.form.cost = String(minPrice ?? params?.cost ?? 0);
    } else {
      seed.form.cost = String(params?.cost ?? 0);
      seed.ticketTypes = [];
    }
  }

  if (selected.has('age')) seed.form.ageLimit = ageToForm(params?.ageLimit);
  if (selected.has('participants') && params?.maxPersonsCount != null) {
    seed.form.maxPersons = String(params.maxPersonsCount);
  }
  if (selected.has('gender')) {
    const gender = params?.allowedGender;
    seed.form.allowedGender = gender === 'Male' || gender === 'Female' ? gender : '' as Gender | '';
  }

  if (selected.has('eventType')) {
    const types = await fetchEventTypesByEvent(event.id).catch(() => []);
    const fromApi = types.map(t => t.id).filter(Boolean);
    const fromEvent = (event.eventTypes ?? [])
      .map(t => t.id)
      .filter(Boolean);
    const fallback = event.eventType?.id ? [event.eventType.id] : [];
    seed.selectedTypes = fromApi.length > 0 ? fromApi : (fromEvent.length > 0 ? fromEvent : fallback);
  }

  if (selected.has('bwList')) {
    const isPrivate = Boolean(params?.private);
    seed.form.isPrivate = isPrivate;
    const listType = isPrivate ? 'whiteList' : 'blackList';
    const items = await getBWList(listType, event.id).catch(() => []);
    const users = mapListUsers(items);
    if (isPrivate) seed.whitelist = users;
    else seed.blacklist = users;
  }

  seed.form.startDate = '';
  seed.form.startTime = '';
  seed.form.endDate = '';
  seed.form.endTime = '';
  return seed;
}

export function saveSimilarEventSeed(seed: CreateEventDraftSnapshot): void {
  const safe: CreateEventDraftSnapshot = {
    ...seed,
    form: {
      ...seed.form,
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
    },
    endMode: 'duration',
    durationH: '2',
    durationM: '0',
    ticketTypes: seed.ticketTypes ?? [],
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
}

export function consumeSimilarEventSeed(): CreateEventDraftSnapshot | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CreateEventDraftSnapshot;
    if (!parsed?.host || !parsed.form) return null;
    parsed.form = {
      ...parsed.form,
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
    };
    parsed.endMode = 'duration';
    parsed.durationH = '2';
    parsed.durationM = '0';
    parsed.ticketTypes = Array.isArray(parsed.ticketTypes) ? parsed.ticketTypes : [];
    return parsed;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}
