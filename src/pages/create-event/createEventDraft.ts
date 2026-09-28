// Локальный черновик формы создания события (без API).
// Ключ привязан к аккаунту, чтобы черновик не пересекался между пользователями.

import { DEFAULT_COVER_FOCUS, normalizeCoverFocus, type CoverFocus } from '@/shared/lib/coverFocus';
import type { Gender } from '@/shared/api/types';
import type { CreateEventHost } from './CreateEventHostChooser';
import type { IWhitelistUser } from './WhitelistModal';

const STORAGE_PREFIX = 'elist_create_event_draft:';
const DRAFT_VERSION = 1 as const;

export interface CreateEventDraftForm {
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

export interface CreateEventDraft {
  v: typeof DRAFT_VERSION;
  savedAt: number;
  host: CreateEventHost;
  form: CreateEventDraftForm;
  lat: number | null;
  lng: number | null;
  coverImageId: string | null;
  coverUrl: string | null;
  coverFocus: CoverFocus;
  selectedCategories: string[];
  selectedTypes: string[];
  endMode: 'duration' | 'multiday';
  durationH: string;
  durationM: string;
  whitelist: IWhitelistUser[];
  blacklist: IWhitelistUser[];
  inviteUserIds: string[];
  autoInviteEnabled: boolean;
  autoInviteMode: 'all' | 'select';
}

function storageKey(accountId: string): string {
  return `${STORAGE_PREFIX}${accountId.trim().toLowerCase()}`;
}

export function persistableCoverUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  if (!u || u.startsWith('data:') || u.startsWith('blob:')) return null;
  return u;
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asBool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

function parseHost(raw: unknown): CreateEventHost | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.kind === 'user') return { kind: 'user' };
  if (o.kind === 'organization' && typeof o.organizationId === 'string' && o.organizationId) {
    return {
      kind: 'organization',
      organizationId: o.organizationId,
      organizationName: asString(o.organizationName, 'Организация') || 'Организация',
      canSellTickets: asBool(o.canSellTickets),
    };
  }
  return null;
}

function parseUsers(raw: unknown): IWhitelistUser[] {
  if (!Array.isArray(raw)) return [];
  const out: IWhitelistUser[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.accountId !== 'string' || !o.accountId) continue;
    out.push({
      accountId: o.accountId,
      login: asString(o.login, o.accountId.slice(0, 8)),
      firstName: typeof o.firstName === 'string' ? o.firstName : null,
      lastName: typeof o.lastName === 'string' ? o.lastName : null,
      avatarId: typeof o.avatarId === 'string' ? o.avatarId : null,
    });
  }
  return out;
}

function parseForm(raw: unknown): CreateEventDraftForm {
  const o = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const gender = o.allowedGender;
  const allowedGender: Gender | '' =
    gender === 'Male' || gender === 'Female' || gender === '' ? gender : '';
  return {
    name: asString(o.name),
    description: asString(o.description),
    address: asString(o.address),
    startDate: asString(o.startDate),
    startTime: asString(o.startTime),
    endDate: asString(o.endDate),
    endTime: asString(o.endTime),
    cost: asString(o.cost, '0') || '0',
    ageLimit: asString(o.ageLimit),
    isPrivate: asBool(o.isPrivate),
    maxPersons: asString(o.maxPersons),
    allowUsersToInvite: asBool(o.allowUsersToInvite, true),
    allowedGender,
    ticketsEnabled: asBool(o.ticketsEnabled),
  };
}

export function loadCreateEventDraft(accountId: string | null | undefined): CreateEventDraft | null {
  if (!accountId) return null;
  try {
    const raw = localStorage.getItem(storageKey(accountId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.v !== DRAFT_VERSION) return null;
    const host = parseHost(parsed.host);
    if (!host) return null;
    const endMode = parsed.endMode === 'multiday' ? 'multiday' : 'duration';
    const autoInviteMode = parsed.autoInviteMode === 'all' ? 'all' : 'select';
    const lat = typeof parsed.lat === 'number' && Number.isFinite(parsed.lat) ? parsed.lat : null;
    const lng = typeof parsed.lng === 'number' && Number.isFinite(parsed.lng) ? parsed.lng : null;
    return {
      v: DRAFT_VERSION,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
      host,
      form: parseForm(parsed.form),
      lat,
      lng,
      coverImageId: typeof parsed.coverImageId === 'string' && parsed.coverImageId
        ? parsed.coverImageId
        : null,
      coverUrl: persistableCoverUrl(asString(parsed.coverUrl) || null),
      coverFocus: normalizeCoverFocus(
        parsed.coverFocus && typeof parsed.coverFocus === 'object'
          ? parsed.coverFocus as CoverFocus
          : DEFAULT_COVER_FOCUS,
      ),
      selectedCategories: asStringList(parsed.selectedCategories),
      selectedTypes: asStringList(parsed.selectedTypes),
      endMode,
      durationH: asString(parsed.durationH, '2') || '2',
      durationM: asString(parsed.durationM, '0') || '0',
      whitelist: parseUsers(parsed.whitelist),
      blacklist: parseUsers(parsed.blacklist),
      inviteUserIds: asStringList(parsed.inviteUserIds),
      autoInviteEnabled: asBool(parsed.autoInviteEnabled),
      autoInviteMode,
    };
  } catch {
    return null;
  }
}

export function saveCreateEventDraft(
  accountId: string | null | undefined,
  draft: Omit<CreateEventDraft, 'v' | 'savedAt'>,
): void {
  if (!accountId || !draft.host) return;
  try {
    const payload: CreateEventDraft = {
      ...draft,
      v: DRAFT_VERSION,
      savedAt: Date.now(),
      coverUrl: persistableCoverUrl(draft.coverUrl),
    };
    localStorage.setItem(storageKey(accountId), JSON.stringify(payload));
  } catch {
    /* QuotaExceeded или приватный режим — черновик просто не пишется */
  }
}

export function clearCreateEventDraft(accountId: string | null | undefined): void {
  if (!accountId) return;
  try {
    localStorage.removeItem(storageKey(accountId));
  } catch {
    /* ignore */
  }
}
