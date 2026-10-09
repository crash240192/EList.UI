// entities/event/ticketTypesApi.ts
// Типы билетов мероприятия (GET + payload для assign/create)

import { apiClient } from '@/shared/api/client';

export interface IEventTicketType {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  capacity: number | null;
  sortOrder: number;
  active: boolean;
}

/** Тело одного типа в assign parameters / create event (без server id при создании). */
export interface IEventTicketTypeRequest {
  id?: string | null;
  name: string;
  description?: string | null;
  price: number;
  capacity?: number | null;
  sortOrder: number;
  active: boolean;
}

/** Черновик типа в форме создания / similar-event (локальный clientKey). */
export interface ITicketTypeDraft {
  clientKey: string;
  /** Server id при редактировании существующего события; null при create/similar. */
  id: string | null;
  name: string;
  description: string;
  price: string;
  capacity: string;
  sortOrder: number;
  active: boolean;
}

function asStr(v: unknown, fallback = ''): string {
  return v == null ? fallback : String(v);
}

function asNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function newClientKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyTicketTypeDraft(sortOrder = 0): ITicketTypeDraft {
  return {
    clientKey: newClientKey(),
    id: null,
    name: sortOrder === 0 ? 'Стандарт' : '',
    description: '',
    price: '0',
    capacity: '',
    sortOrder,
    active: true,
  };
}

export function ticketTypeDraftFromApi(item: IEventTicketType): ITicketTypeDraft {
  return {
    clientKey: item.id || newClientKey(),
    id: item.id || null,
    name: item.name || 'Стандарт',
    description: item.description ?? '',
    price: String(item.price ?? 0),
    capacity: item.capacity != null ? String(item.capacity) : '',
    sortOrder: item.sortOrder ?? 0,
    active: item.active !== false,
  };
}

/** Копия для similar-event: без server id. */
export function ticketTypeDraftCloneForSeed(item: IEventTicketType): ITicketTypeDraft {
  return {
    ...ticketTypeDraftFromApi(item),
    clientKey: newClientKey(),
    id: null,
  };
}

/**
 * Черновик из payload шаблона / CreateEventRequest (без server id).
 * Принимает camelCase и PascalCase поля.
 */
export function ticketTypeDraftFromRequest(raw: unknown, sortOrder = 0): ITicketTypeDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const nameRaw = o.name ?? o.Name;
  const priceRaw = o.price ?? o.Price;
  const capacityRaw = o.capacity ?? o.Capacity;
  const descRaw = o.description ?? o.Description;
  const activeRaw = o.active ?? o.Active;
  const sortRaw = o.sortOrder ?? o.SortOrder;

  const priceNum = asNum(priceRaw, 0);
  const capacity =
    capacityRaw == null || capacityRaw === ''
      ? ''
      : String(Math.max(1, Math.trunc(asNum(capacityRaw, 0)) || 1));

  return {
    clientKey: newClientKey(),
    id: null,
    name: asStr(nameRaw, 'Стандарт') || 'Стандарт',
    description: descRaw == null || descRaw === '' ? '' : String(descRaw),
    price: String(priceNum >= 0 ? priceNum : 0),
    capacity,
    sortOrder: typeof sortRaw === 'number' && Number.isFinite(sortRaw) ? sortRaw : sortOrder,
    active: activeRaw === undefined || activeRaw === null ? true : Boolean(activeRaw),
  };
}

/** Список черновиков из массива ticketTypes в шаблоне (только активные по умолчанию). */
export function ticketTypeDraftsFromTemplateParams(
  ticketTypesRaw: unknown,
  opts?: { includeInactive?: boolean },
): ITicketTypeDraft[] {
  if (!Array.isArray(ticketTypesRaw)) return [];
  const includeInactive = opts?.includeInactive === true;
  const drafts: ITicketTypeDraft[] = [];
  for (const item of ticketTypesRaw) {
    const draft = ticketTypeDraftFromRequest(item, drafts.length);
    if (!draft) continue;
    if (!includeInactive && !draft.active) continue;
    draft.sortOrder = drafts.length;
    drafts.push(draft);
  }
  return drafts;
}

export function parseTicketTypePrice(raw: string): number {
  const n = Number.parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : Number.NaN;
}

export function minActiveTicketTypePrice(drafts: ITicketTypeDraft[]): number | null {
  const prices = drafts
    .filter(t => t.active)
    .map(t => parseTicketTypePrice(t.price))
    .filter(n => Number.isFinite(n) && n >= 0);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

export function toTicketTypeRequests(drafts: ITicketTypeDraft[]): IEventTicketTypeRequest[] {
  return drafts.map((t, index) => {
    const price = parseTicketTypePrice(t.price);
    const capacityRaw = t.capacity.trim();
    const capacity = capacityRaw === ''
      ? null
      : Math.max(1, Math.trunc(Number(capacityRaw) || 0));
    return {
      id: t.id || null,
      name: t.name.trim() || 'Стандарт',
      description: t.description.trim() || null,
      price: Number.isFinite(price) && price >= 0 ? price : 0,
      capacity,
      sortOrder: index,
      active: t.active,
    };
  });
}

/**
 * GET /api/events/{eventId}/ticket-types
 */
export async function fetchEventTicketTypes(
  eventId: string,
  includeInactive = false,
): Promise<IEventTicketType[]> {
  const q = includeInactive ? '?includeInactive=true' : '';
  const data = await apiClient.get<IEventTicketType[] | null>(
    `/api/events/${eventId}/ticket-types${q}`,
  );
  const rawList = (data.result ?? data) as unknown;
  if (!Array.isArray(rawList)) return [];

  return rawList
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map(raw => ({
      id: asStr(raw.id ?? raw.Id),
      eventId: asStr(raw.eventId ?? raw.EventId),
      name: asStr(raw.name ?? raw.Name, 'Стандарт'),
      description: (() => {
        const v = raw.description ?? raw.Description;
        return v == null || v === '' ? null : String(v);
      })(),
      price: asNum(raw.price ?? raw.Price),
      currency: asStr(raw.currency ?? raw.Currency, 'RUB') || 'RUB',
      capacity: (() => {
        const v = raw.capacity ?? raw.Capacity;
        if (v == null || v === '') return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      })(),
      sortOrder: asNum(raw.sortOrder ?? raw.SortOrder),
      active: Boolean(raw.active ?? raw.Active ?? true),
    }));
}
