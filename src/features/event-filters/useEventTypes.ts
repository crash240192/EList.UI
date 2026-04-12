// features/event-filters/useEventTypes.ts
// Загружает категории и типы мероприятий, группирует типы по категориям.
// Результат кешируется в памяти на время сессии.

import { useState, useEffect } from 'react';
import { fetchEventCategories, fetchEventTypes } from '@/entities/event';
import type { IEventCategory, IEventType } from '@/entities/event';

export interface CategoryWithTypes {
  category: IEventCategory;
  types: IEventType[];
}

interface UseEventTypesResult {
  groups: CategoryWithTypes[];
  loading: boolean;
  error: string | null;
}

// Простой in-memory кеш — не перезапрашиваем при каждом открытии пикера
let cache: CategoryWithTypes[] | null = null;

export function useEventTypes(): UseEventTypesResult {
  const [groups, setGroups] = useState<CategoryWithTypes[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (cache) return; // уже загружено
    setLoading(true);
    Promise.all([fetchEventCategories(), fetchEventTypes()])
      .then(([categories, types]) => {
        const result: CategoryWithTypes[] = categories.map(cat => ({
          category: cat,
          types: types.filter(t => t.eventCategoryId === cat.id),
        })).filter(g => g.types.length > 0);
        cache = result;
        setGroups(result);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  return { groups, loading, error };
}
