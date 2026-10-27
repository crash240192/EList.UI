// entities/media/albumApi.ts

import { apiClient } from '@/shared/api/client';
import type { PagedList } from '@/shared/api/types';
import type { EventListItemData } from '@/entities/event/lib/eventListItemUtils';
import { normalizeEventListItem } from '@/entities/event/normalizeEventListItem';
import { fetchEventParameters } from '@/entities/event/eventExtrasApi';
import { fetchEvents } from '@/entities/event/api';
import { createConcurrencyLimiter } from '@/shared/lib/concurrencyLimit';

/** Параллельные filesByAlbumId на ленте мозаик — не больше 4. */
const limitAlbumCoverList = createConcurrencyLimiter(4);
export interface IAlbumParams {
  albumId?: string;
  headAlbum?: boolean;
  participantsReadonly?: boolean;
  private?: boolean;
  /** 1 = DiscussionPhotos и т.п.; null/undefined — обычный альбом */
  systemKind?: number | null;
}

export interface IAlbum {
  id: string;
  name: string;
  description?: string;
  eventId?: string;
  accountId?: string;
  organizationId?: string;
  wallpaperId?: string;
  parameters?: IAlbumParams;
  /** Когда в альбом последний раз добавили фото. */
  lastContentAt?: string;
  /** Когда текущий пользователь последний раз открывал альбом. */
  lastViewedAt?: string;
  /** Сервер уже сравнил даты. Если поля нет — считаем по lastContentAt / lastViewedAt. */
  hasNewContent?: boolean;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Новые фото после последнего просмотра. Старый API без полей — не новый. */
export function albumHasNewContent(
  album: Pick<IAlbum, 'hasNewContent' | 'lastContentAt' | 'lastViewedAt'>,
): boolean {
  if (typeof album.hasNewContent === 'boolean') return album.hasNewContent;
  const content = album.lastContentAt ? Date.parse(album.lastContentAt) : NaN;
  if (!Number.isFinite(content)) return false;
  const viewed = album.lastViewedAt ? Date.parse(album.lastViewedAt) : NaN;
  if (!Number.isFinite(viewed)) return true;
  return content > viewed;
}

/** Свежие элементы впереди, исходный порядок среди равных сохраняется. */
export function orderFreshFirst<T>(items: readonly T[], isFresh: (item: T) => boolean): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const freshRank = Number(isFresh(b.item)) - Number(isFresh(a.item));
      if (freshRank !== 0) return freshRank;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

/**
 * Копия списка для показа: просмотренные альбомы больше не свежие,
 * открытый альбом остаётся на месте, пока модалка не закрыта.
 */
export function presentAlbumsFreshFirst(
  albums: readonly IAlbum[],
  seenIds: ReadonlySet<string>,
  openAlbumId: string | null,
): IAlbum[] {
  const viewedAt = new Date().toISOString();
  const shown = albums.map(album => {
    if (album.id === openAlbumId || !seenIds.has(album.id)) return album;
    return { ...album, hasNewContent: false, lastViewedAt: viewedAt };
  });
  return orderFreshFirst(shown, albumHasNewContent);
}

export function isSystemAlbum(album: IAlbum | null | undefined): boolean {
  return album?.parameters?.systemKind != null;
}

export interface ICreateAlbumPayload {
  name: string;
  description?: string;
  accountId?: string;
  organizationId?: string;
  parameters?: IAlbumParams;
}

/** Создать альбом. EventId не передаём — назначим через assign после создания события */
export async function createAlbum(payload: ICreateAlbumPayload): Promise<string> {
  const res = await apiClient.post<string>('/api/media/albums/create', payload);
  return (res as any).result ?? res as unknown as string;
}

/** Привязать альбом к событию */
export async function assignAlbumToEvent(eventId: string, albumId: string): Promise<void> {
  await apiClient.get(`/api/media/albums/assign/toEvent?eventId=${eventId}&albumId=${albumId}`);
}

export interface IUpdateAlbumPayload {
  id: string;
  name: string;
  description?: string;
  parameters?: IAlbumParams;
}

/** Обновить альбом */
export async function updateAlbum(payload: IUpdateAlbumPayload): Promise<void> {
  await apiClient.put('/api/media/albums/update', payload);
}

/** Удалить альбом */
export async function deleteAlbum(albumId: string): Promise<void> {
  await apiClient.delete(`/api/media/albums/${albumId}`);
}

function normalizeAlbumParams(raw: unknown): IAlbumParams | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const systemRaw = r.systemKind ?? r.SystemKind;
  return {
    albumId: r.albumId != null || r.AlbumId != null ? String(r.albumId ?? r.AlbumId) : undefined,
    headAlbum: Boolean(r.headAlbum ?? r.HeadAlbum),
    participantsReadonly: Boolean(r.participantsReadonly ?? r.ParticipantsReadonly),
    private: Boolean(r.private ?? r.Private),
    systemKind: systemRaw == null || systemRaw === '' ? null : Number(systemRaw),
  };
}

function normalizeAlbum(raw: unknown): IAlbum {
  const r = (raw ?? {}) as Record<string, unknown>;
  const params = normalizeAlbumParams(r.parameters ?? r.Parameters);
  return {
    id: String(r.id ?? r.Id ?? ''),
    name: String(r.name ?? r.Name ?? ''),
    description: r.description != null || r.Description != null
      ? String(r.description ?? r.Description)
      : undefined,
    eventId: r.eventId != null || r.EventId != null ? String(r.eventId ?? r.EventId) : undefined,
    accountId: r.accountId != null || r.AccountId != null ? String(r.accountId ?? r.AccountId) : undefined,
    organizationId: r.organizationId != null || r.OrganizationId != null
      ? String(r.organizationId ?? r.OrganizationId)
      : undefined,
    wallpaperId: r.wallpaperId != null || r.WallpaperId != null
      ? String(r.wallpaperId ?? r.WallpaperId)
      : undefined,
    parameters: params,
    lastContentAt: readOptionalString(r.lastContentAt ?? r.LastContentAt),
    lastViewedAt: readOptionalString(r.lastViewedAt ?? r.LastViewedAt),
    hasNewContent: typeof (r.hasNewContent ?? r.HasNewContent) === 'boolean'
      ? (r.hasNewContent ?? r.HasNewContent) as boolean
      : undefined,
  };
}

/** Сбросить HasNewContent у текущего пользователя. Тело запроса пустое. */
export async function markAlbumViewed(albumId: string): Promise<void> {
  await apiClient.post(`/api/media/albums/${albumId}/markViewed`);
}

/** Получить альбомы события */
export async function getEventAlbums(eventId: string): Promise<IAlbum[]> {
  const res = await apiClient.get<IAlbum[]>(`/api/media/albums/byEvent/${eventId}`);
  const list = ((res as any).result ?? res) as unknown[];
  return Array.isArray(list) ? list.map(normalizeAlbum) : [];
}

export interface IEventAlbumsGroup {
  event: EventListItemData;
  albums: IAlbum[];
}

/** События со свежими альбомами поднимаются, внутри события свежие альбомы — первыми. */
export function presentAlbumGroupsFreshFirst(
  groups: readonly IEventAlbumsGroup[],
  seenIds: ReadonlySet<string>,
  openAlbumId: string | null,
): IEventAlbumsGroup[] {
  const shown = groups.map(group => ({
    ...group,
    albums: presentAlbumsFreshFirst(group.albums, seenIds, openAlbumId),
  }));
  return orderFreshFirst(shown, group => group.albums.some(albumHasNewContent));
}

function normalizeAlbumsGroup(raw: unknown): IEventAlbumsGroup {
  const row = (raw ?? {}) as Record<string, unknown>;
  const event = row.event ?? row.Event;
  const albumsRaw = row.albums ?? row.Albums;
  const albums = Array.isArray(albumsRaw) ? albumsRaw.map(normalizeAlbum) : [];
  return {
    event: normalizeEventListItem(event),
    albums,
  };
}

async function enrichAlbumGroupsWithParameters(groups: IEventAlbumsGroup[]): Promise<IEventAlbumsGroup[]> {
  const missing = groups.filter(g => g.event.id && g.event.parameters?.ageLimit == null);
  if (missing.length === 0) return groups;

  const eventIds = [...new Set(missing.map(g => g.event.id))];
  const paramsByEvent = new Map<string, Awaited<ReturnType<typeof fetchEventParameters>>>();

  await Promise.all(eventIds.map(async eventId => {
    paramsByEvent.set(eventId, await fetchEventParameters(eventId));
  }));

  return groups.map(group => {
    if (group.event.parameters?.ageLimit != null) return group;

    const params = paramsByEvent.get(group.event.id);
    if (!params) return group;

    return {
      ...group,
      event: {
        ...group.event,
        parameters: {
          cost: params.cost ?? group.event.parameters?.cost ?? 0,
          ageLimit: params.ageLimit,
          maxPersonsCount: params.maxPersonsCount ?? group.event.parameters?.maxPersonsCount ?? null,
        },
      },
    };
  });
}

/** Альбомы, сгруппированные по мероприятиям, доступные аккаунту */
export async function getAlbumsByEvents(
  accountId: string,
  pageIndex = 0,
  pageSize = 10,
): Promise<PagedList<IEventAlbumsGroup>> {
  const res = await apiClient.get<PagedList<IEventAlbumsGroup>>(
    `/api/media/albums/byEvents?accountId=${encodeURIComponent(accountId)}&pageIndex=${pageIndex}&pageSize=${pageSize}`,
  );
  const data = ((res as { result?: PagedList<IEventAlbumsGroup> }).result ?? res) as PagedList<IEventAlbumsGroup>;
  const groups = Array.isArray(data.result) ? data.result.map(normalizeAlbumsGroup) : [];
  const enriched = await enrichAlbumGroupsWithParameters(groups);
  return {
    ...data,
    result: enriched,
  };
}

/**
 * Альбомы мероприятий организации: обходим события org и подтягиваем альбомы.
 * В swagger нет byEvents?organizationId — собираем группы на клиенте.
 */
export async function getAlbumsByOrganizationEvents(
  organizationId: string,
  pageIndex = 0,
  pageSize = 10,
): Promise<PagedList<IEventAlbumsGroup>> {
  const EVENT_SCAN_SIZE = Math.max(pageSize * 3, 20);
  const collected: IEventAlbumsGroup[] = [];
  let eventPage = 0;
  let eventsTotal = 0;
  let scanned = 0;
  const skip = pageIndex * pageSize;

  while (collected.length < skip + pageSize) {
    const eventsPage = await fetchEvents({
      organizationId,
      pageIndex: eventPage,
      pageSize: EVENT_SCAN_SIZE,
    });
    eventsTotal = eventsPage.total;
    const batch = eventsPage.result ?? [];
    if (batch.length === 0) break;

    const groups = await Promise.all(
      batch.map(async (event) => {
        const albums = await getEventAlbums(event.id).catch(() => [] as IAlbum[]);
        if (!albums.length) return null;
        return {
          event: normalizeEventListItem(event),
          albums,
        } satisfies IEventAlbumsGroup;
      }),
    );

    for (const g of groups) {
      if (g) collected.push(g);
    }

    scanned += batch.length;
    eventPage += 1;
    if (scanned >= eventsTotal || batch.length < EVENT_SCAN_SIZE) break;
  }

  const pageGroups = collected.slice(skip, skip + pageSize);
  const enriched = await enrichAlbumGroupsWithParameters(pageGroups);

  // Пока не просканировали все события — total как нижняя граница + «есть ещё»
  const exhausted = scanned >= eventsTotal;
  const total = exhausted
    ? collected.length
    : Math.max(collected.length, skip + pageGroups.length + (pageGroups.length === pageSize ? 1 : 0));

  return {
    pageIndex,
    pageSize,
    total,
    result: enriched,
  };
}

export interface IAlbumFile {
  id: string;
  fileId: string;
  albumId: string;
}

interface AlbumFilesPage {
  files: IAlbumFile[];
  total: number;
}

function readAlbumFileTotal(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.trunc(numeric));
}

function parseAlbumFilesPage(res: unknown): AlbumFilesPage {
  const data = (res as { result?: unknown } | null)?.result ?? res;
  let files: IAlbumFile[] = [];
  let declaredTotal: unknown;

  if (Array.isArray(data)) {
    files = data as IAlbumFile[];
  } else if (data && typeof data === 'object') {
    const page = data as { result?: unknown; items?: unknown; total?: unknown; Total?: unknown };
    if (Array.isArray(page.result)) files = page.result as IAlbumFile[];
    else if (Array.isArray(page.items)) files = page.items as IAlbumFile[];
    declaredTotal = page.total ?? page.Total;
  }

  return {
    files,
    total: readAlbumFileTotal(declaredTotal, files.length),
  };
}

async function fetchAlbumFilesPage(albumId: string, pageIndex: number, pageSize: number): Promise<AlbumFilesPage> {
  const res = await apiClient.get<unknown>(
    `/api/media/albums/filesByAlbumId/${albumId}?pageIndex=${pageIndex}&pageSize=${pageSize}`,
  );
  return parseAlbumFilesPage(res);
}

/** Получить файлы альбома */
export async function getAlbumFiles(albumId: string, pageIndex = 1, pageSize = 50): Promise<IAlbumFile[]> {
  const page = await fetchAlbumFilesPage(albumId, pageIndex, pageSize);
  return page.files;
}

/** Сколько фото в альбоме. pageSize=1: достаточно поля total. */
export async function getAlbumFileCount(albumId: string): Promise<number> {
  return limitAlbumCoverList(async () => {
    const page = await fetchAlbumFilesPage(albumId, 1, 1);
    return page.total;
  });
}

/**
 * Первые fileId и общее число фото одним запросом.
 * Через очередь — на страницах со многими альбомами не роняем API/браузер.
 */
export async function getAlbumCoverPreview(
  albumId: string,
  limit = 4,
): Promise<{ fileIds: string[]; total: number }> {
  const safeLimit = Math.max(1, Math.min(limit, 4));
  return limitAlbumCoverList(async () => {
    const page = await fetchAlbumFilesPage(albumId, 1, safeLimit);
    return {
      fileIds: page.files.slice(0, safeLimit).map(file => file.fileId).filter(Boolean),
      total: page.total,
    };
  });
}

/** Первые fileId для превью обложки/мозаики. */
export async function getAlbumCoverFileIds(albumId: string, limit = 4): Promise<string[]> {
  const preview = await getAlbumCoverPreview(albumId, limit);
  return preview.fileIds;
}
