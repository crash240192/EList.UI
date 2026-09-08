// features/event-filters/useEventTypes.ts
// Загружает категории и типы мероприятий, группирует типы по категориям.
// Справочники кешируются в entities/event/dictionariesCache (активные по умолчанию).

import { useState, useEffect } from 'react';
import { fetchEventCategories, fetchEventTypes } from '@/entities/event';
import type { IEventCategory, IEventType } from '@/entities/event';
import { sortByNameRu } from '@/entities/event/lib/sortByNameRu';

export interface CategoryWithTypes {
  category: IEventCategory;
  types: IEventType[];
}

interface UseEventTypesResult {
  groups: CategoryWithTypes[];
  loading: boolean;
  error: string | null;
}

export function useEventTypes(): UseEventTypesResult {
  const [groups, setGroups] = useState<CategoryWithTypes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchEventCategories(), fetchEventTypes()])
      .then(([categories, types]) => {
        if (cancelled) return;
        const result: CategoryWithTypes[] = sortByNameRu(categories).map(cat => ({
          category: cat,
          types: sortByNameRu(types.filter(t => t.eventCategoryId === cat.id)),
        })).filter(g => g.types.length > 0);
        setGroups(result);
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { groups, loading, error };
}
