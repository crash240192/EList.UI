// entities/event/dictionariesCache.ts
// In-memory кеш справочников категорий и типов на время сессии (с TTL).

import { apiClient } from '@/shared/api/client';
import { sortByNameRu } from './lib/sortByNameRu';
import type { IEventCategory, IEventType } from './types';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 час

interface CacheEntry<T> {
  data: T;
  at: number;
}

let categoriesCache: CacheEntry<IEventCategory[]> | null = null;
let typesCache: CacheEntry<IEventType[]> | null = null;
let categoriesInflight: Promise<IEventCategory[]> | null = null;
let typesInflight: Promise<IEventType[]> | null = null;

function isFresh<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  return entry != null && Date.now() - entry.at < CACHE_TTL_MS;
}

function asBool(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

export function normalizeEventCategory(raw: unknown): IEventCategory | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const id = String(c.id ?? c.Id ?? '');
  if (!id) return null;
  return {
    id,
    name: String(c.name ?? c.Name ?? ''),
    namePath: String(
      c.namePath ?? c.NamePath ?? c.localizationPath ?? c.LocalizationPath ?? '',
    ),
    ico: (c.ico ?? c.Ico ?? null) as string | null,
    description: (c.description ?? c.Description ?? null) as string | null,
    color: (c.color ?? c.Color ?? null) as string | null,
    active: asBool(c.active ?? c.Active, true),
  };
}

export function normalizeEventType(raw: unknown): IEventType | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const id = String(t.id ?? t.Id ?? '');
  if (!id) return null;
  const catRaw = t.eventCategory ?? t.EventCategory;
  const category = normalizeEventCategory(catRaw);
  return {
    id,
    name: String(t.name ?? t.Name ?? ''),
    namePath: String(
      t.namePath ?? t.NamePath ?? t.localizationPath ?? t.LocalizationPath ?? '',
    ),
    description: (t.description ?? t.Description ?? null) as string | null,
    ico: (t.ico ?? t.Ico ?? null) as string | null,
    eventCategoryId: String(
      t.eventCategoryId
      ?? t.EventCategoryId
      ?? (catRaw as Record<string, unknown> | undefined)?.id
      ?? (catRaw as Record<string, unknown> | undefined)?.Id
      ?? '',
    ),
    eventCategory: category,
    active: asBool(t.active ?? t.Active, true),
  };
}

function isActiveItem(item: { active?: boolean }): boolean {
  return item.active !== false;
}

export function filterActiveCategories(categories: IEventCategory[]): IEventCategory[] {
  return categories.filter(isActiveItem);
}

export function filterActiveTypes(types: IEventType[]): IEventType[] {
  return types.filter(isActiveItem);
}

export function invalidateEventDictionariesCache(): void {
  categoriesCache = null;
  typesCache = null;
  categoriesInflight = null;
  typesInflight = null;
}

async function loadCategoriesFromApi(): Promise<IEventCategory[]> {
  const data = await apiClient.get<unknown[]>('/api/events/eventCategories/getAll');
  const list = (data.result ?? [])
    .map(normalizeEventCategory)
    .filter((c): c is IEventCategory => c != null);
  return sortByNameRu(list);
}

async function loadTypesFromApi(categoryId?: string): Promise<IEventType[]> {
  const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
  const data = await apiClient.get<unknown[]>(`/api/events/eventTypes/getAll${qs}`);
  const list = (data.result ?? [])
    .map(normalizeEventType)
    .filter((t): t is IEventType => t != null);
  return sortByNameRu(list);
}

export interface FetchDictionariesOptions {
  /** Включить неактивные (для админки / резолва уже выбранных). По умолчанию false. */
  includeInactive?: boolean;
  /** Игнорировать кеш и перезапросить API */
  force?: boolean;
}

/**
 * Категории мероприятий. По умолчанию только активные, с in-memory кешем.
 */
export async function fetchEventCategories(
  options: FetchDictionariesOptions = {},
): Promise<IEventCategory[]> {
  const { includeInactive = false, force = false } = options;

  if (!force && isFresh(categoriesCache)) {
    return includeInactive
      ? categoriesCache.data
      : filterActiveCategories(categoriesCache.data);
  }

  if (!force && categoriesInflight) {
    const data = await categoriesInflight;
    return includeInactive ? data : filterActiveCategories(data);
  }

  categoriesInflight = loadCategoriesFromApi()
    .then((data) => {
      categoriesCache = { data, at: Date.now() };
      return data;
    })
    .finally(() => {
      categoriesInflight = null;
    });

  const data = await categoriesInflight;
  return includeInactive ? data : filterActiveCategories(data);
}

/**
 * Типы мероприятий. По умолчанию только активные, с in-memory кешем
 * (полный список без categoryId). Фильтр по categoryId — из кеша или API.
 */
export async function fetchEventTypes(
  categoryId?: string,
  options: FetchDictionariesOptions = {},
): Promise<IEventType[]> {
  const { includeInactive = false, force = false } = options;

  // Запрос с categoryId — не кешируем отдельно, берём из полного списка если есть
  if (categoryId) {
    const all = await fetchEventTypes(undefined, { includeInactive: true, force });
    const filtered = all.filter(t => t.eventCategoryId === categoryId);
    return includeInactive ? filtered : filterActiveTypes(filtered);
  }

  if (!force && isFresh(typesCache)) {
    return includeInactive ? typesCache.data : filterActiveTypes(typesCache.data);
  }

  if (!force && typesInflight) {
    const data = await typesInflight;
    return includeInactive ? data : filterActiveTypes(data);
  }

  typesInflight = loadTypesFromApi()
    .then((data) => {
      typesCache = { data, at: Date.now() };
      return data;
    })
    .finally(() => {
      typesInflight = null;
    });

  const data = await typesInflight;
  return includeInactive ? data : filterActiveTypes(data);
}
