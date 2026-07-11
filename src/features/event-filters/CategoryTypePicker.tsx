// features/event-filters/CategoryTypePicker.tsx
// Всплывающее окно выбора категорий и типов мероприятий.
// Категории → группы, внутри каждой — типы с чекбоксами.

import { useEffect, useRef, useState } from 'react';
import { useEventTypes } from './useEventTypes';
import type { CategoryWithTypes } from './useEventTypes';
import { icoToUrl } from '@/shared/lib/icoToUrl';
import styles from './CategoryTypePicker.module.css';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';

interface CategoryTypePickerProps {
  /** Выбранные ID категорий */
  selectedCategories: string[];
  /** Выбранные ID типов */
  selectedTypes: string[];
  onChange: (categories: string[], types: string[]) => void;
  onClose: () => void;
  /** Подтверждение выбора; по умолчанию вызывается onClose */
  onApply?: () => void;
  /** Внутри другой модалки — не дублируем history.pushState */
  nested?: boolean;
}

function buildInitialExpanded(
  groups: CategoryWithTypes[],
  selectedCategories: string[],
  selectedTypes: string[],
): Set<string> {
  const ids = new Set<string>();
  for (const { category, types } of groups) {
    if (
      selectedCategories.includes(category.id) ||
      types.some(t => selectedTypes.includes(t.id))
    ) {
      ids.add(category.id);
    }
  }
  return ids;
}

export function CategoryTypePicker({
  selectedCategories,
  selectedTypes,
  onChange,
  onClose,
  onApply,
  nested = false,
}: CategoryTypePickerProps) {
  useModalBackButton(onClose, !nested);
  const { groups, loading, error } = useEventTypes();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const initExpandedRef = useRef(false);

  useEffect(() => {
    if (initExpandedRef.current || loading || groups.length === 0) return;
    initExpandedRef.current = true;
    setExpandedIds(buildInitialExpanded(groups, selectedCategories, selectedTypes));
  }, [loading, groups, selectedCategories, selectedTypes]);

  const toggleExpanded = (catId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  // Закрытие по Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  // ---- Toggle helpers ----

  const toggleCategory = (catId: string) => {
    const group = groups.find(g => g.category.id === catId);
    if (!group) return;

    const catSelected = selectedCategories.includes(catId);

    let nextCategories: string[];
    let nextTypes: string[];

    if (catSelected) {
      // Снимаем категорию и все её типы
      nextCategories = selectedCategories.filter(id => id !== catId);
      const typeIds  = group.types.map(t => t.id);
      nextTypes      = selectedTypes.filter(id => !typeIds.includes(id));
    } else {
      // Выбираем категорию, снимаем отдельно выбранные её типы (они покрыты категорией)
      nextCategories = [...selectedCategories, catId];
      const typeIds  = group.types.map(t => t.id);
      nextTypes      = selectedTypes.filter(id => !typeIds.includes(id));
    }

    onChange(nextCategories, nextTypes);
  };

  const toggleType = (typeId: string, catId: string) => {
    const typeSelected = selectedTypes.includes(typeId);
    const catSelected  = selectedCategories.includes(catId);

    let nextCategories = [...selectedCategories];
    let nextTypes      = [...selectedTypes];

    if (typeSelected) {
      // Снимаем тип
      nextTypes = nextTypes.filter(id => id !== typeId);
    } else {
      if (catSelected) {
        // Категория выбрана целиком — снимаем её, добавляем все типы кроме снятого
        const group = groups.find(g => g.category.id === catId);
        if (group) {
          nextCategories = nextCategories.filter(id => id !== catId);
          const otherTypes = group.types.map(t => t.id).filter(id => id !== typeId);
          nextTypes = [...new Set([...nextTypes, ...otherTypes])];
        }
      } else {
        nextTypes = [...nextTypes, typeId];
      }
    }

    onChange(nextCategories, nextTypes);
  };

  const clearAll = () => onChange([], []);

  const totalSelected = selectedCategories.length + selectedTypes.length;

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />

      <div className={styles.modal} role="dialog" aria-label="Выбор категорий и типов">
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>Тип мероприятия</span>
          <div className={styles.headerRight}>
            {totalSelected > 0 && (
              <button className={styles.clearBtn} onClick={clearAll}>
                Сбросить
              </button>
            )}
            <button className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {loading && <div className={styles.loader}>Загрузка...</div>}
          {error   && <div className={styles.error}>{error}</div>}

          {!loading && !error && groups.map(({ category, types }) => {
            const catSelected  = selectedCategories.includes(category.id);
            const someTypeSel  = types.some(t => selectedTypes.includes(t.id));
            const isIndeterminate = !catSelected && someTypeSel;
            const expanded = expandedIds.has(category.id);
            // Цвет категории или дефолтный акцент приложения
            const catColor = category.color || 'var(--accent)';

            return (
              <div key={category.id} className={styles.group}>
                {/* Цветная полоса на всю высоту группы */}
                <div className={styles.catBar} style={{ background: catColor }} />

                {/* Category row */}
                <div className={`${styles.categoryRow} ${catSelected ? styles.categorySelected : ''}`}>
                  <button
                    type="button"
                    className={`${styles.expandBtn} ${expanded ? styles.expandBtnOpen : ''}`}
                    onClick={() => toggleExpanded(category.id)}
                    aria-expanded={expanded}
                    aria-label={expanded ? 'Свернуть типы' : 'Развернуть типы'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                  <label className={styles.categoryLabel}>
                    <span className={styles.checkboxWrap}>
                      <input
                        type="checkbox"
                        checked={catSelected}
                        ref={el => { if (el) el.indeterminate = isIndeterminate; }}
                        onChange={() => toggleCategory(category.id)}
                      />
                    </span>
                    <span className={styles.categoryName}>{category.name}</span>
                  </label>
                  <span className={styles.typeCount}>{types.length}</span>
                </div>

                {/* Type rows */}
                {expanded && (
                <div className={styles.types}>
                  {types.map(type => {
                    const typeSelected = catSelected || selectedTypes.includes(type.id);
                    return (
                      <label
                        key={type.id}
                        className={`${styles.typeRow} ${typeSelected ? styles.typeSelected : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={typeSelected}
                          onChange={() => toggleType(type.id, category.id)}
                        />
                        {/* Иконка типа */}
                        <span className={styles.typeIcon}>
                          {type.ico
                            ? <img
                                src={icoToUrl(type.ico) ?? ''} className="event-type-ico"
                                alt="" width={14} height={14}
                                style={{ objectFit: 'contain', borderRadius: 2, display: 'block' }}
                              />
                            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2" opacity={0.4}>
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="16"/>
                                <line x1="8" y1="12" x2="16" y2="12"/>
                              </svg>
                          }
                        </span>
                        <span>{type.name}</span>
                      </label>
                    );
                  })}
                </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.applyBtn} onClick={() => (onApply ?? onClose)()}>
            Применить {totalSelected > 0 && `(${totalSelected})`}
          </button>
        </div>
      </div>
    </>
  );
}
