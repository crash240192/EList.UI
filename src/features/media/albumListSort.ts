import { albumHasNewContent, type IAlbum, type IEventAlbumsGroup } from '@/entities/media/albumApi';

/**
 * Порядок плиток на «Альбомы мероприятий».
 *
 * Флоу:
 * 1) Сортировка уходит в byEvents?sort=… (сервер пагинирует уже в нужном порядке).
 * 2) Тумблер «Сначала непросмотренные» поднимает события с новыми фото наверх
 *    среди уже загруженных страниц; внутри корзины порядок сервера сохраняется.
 * 3) Подсветка/glow непросмотренных работает всегда — это не сортировка.
 * 4) Дефолт — «по последним фото»: страница про активность в альбомах.
 *
 * photoCount убрали: избыточно при наличии latestPhotos и даты мероприятия.
 */
export type AlbumListSort = 'date' | 'latestPhotos' | 'name';

export const ALBUM_LIST_SORT_OPTIONS: { id: AlbumListSort; label: string; hint?: string }[] = [
  { id: 'latestPhotos', label: 'По последним фотографиям', hint: 'Свежие загрузки выше' },
  { id: 'date', label: 'По дате мероприятия', hint: 'Сначала более ранние' },
  { id: 'name', label: 'По названию' },
];

/** Страница про фотоактивность, не про календарь событий. */
export const DEFAULT_ALBUM_LIST_SORT: AlbumListSort = 'latestPhotos';

export const ALBUM_LIST_SORT_STORAGE_KEY = 'elist_album_list_sort';
export const ALBUM_LIST_PIN_UNREAD_STORAGE_KEY = 'elist_album_list_pin_unread';

export function readStoredAlbumListSort(): AlbumListSort {
  try {
    const raw = localStorage.getItem(ALBUM_LIST_SORT_STORAGE_KEY);
    if (ALBUM_LIST_SORT_OPTIONS.some(option => option.id === raw)) {
      return raw as AlbumListSort;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_ALBUM_LIST_SORT;
}

export function writeStoredAlbumListSort(sort: AlbumListSort): void {
  try {
    localStorage.setItem(ALBUM_LIST_SORT_STORAGE_KEY, sort);
  } catch {
    /* ignore */
  }
}

export function readStoredPinUnread(defaultValue = true): boolean {
  try {
    const raw = localStorage.getItem(ALBUM_LIST_PIN_UNREAD_STORAGE_KEY);
    if (raw === '0' || raw === 'false') return false;
    if (raw === '1' || raw === 'true') return true;
  } catch {
    /* ignore */
  }
  return defaultValue;
}

export function writeStoredPinUnread(pin: boolean): void {
  try {
    localStorage.setItem(ALBUM_LIST_PIN_UNREAD_STORAGE_KEY, pin ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function timeMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function latestPhotoMs(group: IEventAlbumsGroup): number | null {
  let best: number | null = null;
  for (const album of group.albums) {
    const ms = timeMs(album.lastContentAt);
    if (ms == null) continue;
    if (best == null || ms > best) best = ms;
  }
  return best;
}

/** Сумма photoCount с API; иначе fallback из асинхронного подсчёта. */
export function resolveGroupPhotoTotal(
  group: IEventAlbumsGroup,
  photoTotals: Readonly<Record<string, number | undefined>> = {},
): number | null {
  const albums = group.albums;
  if (albums.length > 0 && albums.every(album => album.photoCount != null)) {
    return albums.reduce((sum, album) => sum + (album.photoCount ?? 0), 0);
  }
  const total = photoTotals[group.event.id];
  return total == null ? null : total;
}

function compareGroups(
  a: IEventAlbumsGroup,
  b: IEventAlbumsGroup,
  sort: AlbumListSort,
): number {
  if (sort === 'name') {
    return a.event.name.localeCompare(b.event.name, 'ru', { sensitivity: 'base' });
  }

  if (sort === 'latestPhotos') {
    const left = latestPhotoMs(a);
    const right = latestPhotoMs(b);
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return right - left;
  }

  const left = timeMs(a.event.startTime);
  const right = timeMs(b.event.startTime);
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  // Сверху более ранняя дата.
  return left - right;
}

/**
 * Клиентский fallback (орг. лента без server sort) и pinUnread поверх серверного порядка.
 * Не меняет альбомы внутри плитки. При равенстве оставляет прежний порядок.
 */
export function sortEventAlbumGroups(
  groups: readonly IEventAlbumsGroup[],
  sort: AlbumListSort | null,
  pinFirst?: (group: IEventAlbumsGroup) => boolean,
): IEventAlbumsGroup[] {
  return groups
    .map((group, index) => ({ group, index }))
    .sort((a, b) => {
      if (pinFirst) {
        const pinned = Number(pinFirst(b.group)) - Number(pinFirst(a.group));
        if (pinned !== 0) return pinned;
      }
      if (sort) {
        const diff = compareGroups(a.group, b.group, sort);
        if (diff !== 0) return diff;
      }
      return a.index - b.index;
    })
    .map(({ group }) => group);
}

/** Есть ли у группы непросмотренные альбомы (после present*). */
export function groupHasUnreadAlbums(group: IEventAlbumsGroup): boolean {
  return group.albums.some(albumHasNewContent);
}

/** Для тестов/подсказок: суммарный photoCount известных альбомов. */
export function sumAlbumPhotoCounts(albums: readonly Pick<IAlbum, 'photoCount'>[]): number | null {
  if (!albums.length || albums.some(album => album.photoCount == null)) return null;
  return albums.reduce((sum, album) => sum + (album.photoCount ?? 0), 0);
}
