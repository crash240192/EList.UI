import type { IEventType } from './types';
import type { EventListItemData } from './lib/eventListItemUtils';

function normalizeEventCategory(raw: unknown): IEventType['eventCategory'] {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  return {
    id: String(c.id ?? c.Id ?? ''),
    name: String(c.name ?? c.Name ?? ''),
    namePath: String(c.namePath ?? c.NamePath ?? ''),
    ico: (c.ico ?? c.Ico ?? null) as string | null,
    description: (c.description ?? c.Description ?? null) as string | null,
    color: (c.color ?? c.Color ?? null) as string | null,
  };
}

function normalizeEventType(raw: unknown): IEventType | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const id = String(t.id ?? t.Id ?? '');
  if (!id) return null;
  const cat = t.eventCategory ?? t.EventCategory;
  return {
    id,
    name: String(t.name ?? t.Name ?? ''),
    namePath: String(t.namePath ?? t.NamePath ?? ''),
    description: (t.description ?? t.Description ?? null) as string | null,
    ico: (t.ico ?? t.Ico ?? null) as string | null,
    eventCategoryId: String(t.eventCategoryId ?? t.EventCategoryId ?? (cat as Record<string, unknown>)?.id ?? ''),
    eventCategory: normalizeEventCategory(cat),
  };
}

function normalizeEventTypes(raw: unknown): IEventType[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeEventType).filter((t): t is IEventType => t != null);
}

/** Нормализует вложенное мероприятие из API (camelCase / PascalCase) для EventListItem */
export function normalizeEventListItem(raw: unknown): EventListItemData {
  const e = (raw ?? {}) as Record<string, unknown>;
  const types = normalizeEventTypes(e.Types ?? e.types ?? e.eventTypes);
  const single = normalizeEventType(e.eventType ?? e.EventType) ?? types[0] ?? null;
  const params = (e.parameters ?? e.Parameters ?? null) as Record<string, unknown> | null;
  const colorsRaw = e.colors ?? e.Colors;
  const colors = Array.isArray(colorsRaw)
    ? colorsRaw.filter((c): c is string => typeof c === 'string' && c.length > 0)
    : undefined;

  return {
    id: String(e.id ?? e.Id ?? ''),
    name: String(e.name ?? e.Name ?? ''),
    startTime: String(e.startTime ?? e.StartTime ?? ''),
    address: (e.address ?? e.Address ?? null) as string | null,
    coverImageId: (e.coverImageId ?? e.CoverImageId ?? null) as string | null,
    coverUrl: (e.coverUrl ?? e.CoverUrl ?? null) as string | null,
    eventTypes: types.length > 0 ? types : single ? [single] : [],
    eventType: single,
    parameters: params
      ? {
          cost: Number(params.cost ?? params.Cost ?? 0),
          ageLimit: (params.ageLimit ?? params.AgeLimit ?? null) as number | null,
          maxPersonsCount: (params.maxPersonsCount ?? params.MaxPersonsCount ?? null) as number | null,
        }
      : null,
    participantsCount: (e.participantsCount ?? e.ParticipantsCount ?? null) as number | null,
    ...(colors?.length ? { colors } : {}),
  };
}
