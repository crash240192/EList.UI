// features/event-filters/CategoryTypePicker.tsx
// Всплывающее окно выбора категорий и типов мероприятий.
// Категории → группы, внутри каждой — типы с чекбоксами.

import { useEffect } from 'react';
import { useEventTypes } from './useEventTypes';
import styles from './CategoryTypePicker.module.css';

interface CategoryTypePickerProps {
  /** Выбранные ID категорий */
  selectedCategories: string[];
  /** Выбранные ID типов */
  selectedTypes: string[];
  onChange: (categories: string[], types: string[]) => void;
  onClose: () => void;
}

export function CategoryTypePicker({
  selectedCategories,
  selectedTypes,
  onChange,
  onClose,
}: CategoryTypePickerProps) {
  const { groups, loading, error } = useEventTypes();

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
            // Тип "частично" — некоторые типы выбраны, но не вся категория
            const someTypeSel  = types.some(t => selectedTypes.includes(t.id));
            const isIndeterminate = !catSelected && someTypeSel;

            return (
              <div key={category.id} className={styles.group}>
                {/* Category row */}
                <label className={`${styles.categoryRow} ${catSelected ? styles.categorySelected : ''}`}>
                  <span className={styles.checkboxWrap}>
                    <input
                      type="checkbox"
                      checked={catSelected}
                      ref={el => { if (el) el.indeterminate = isIndeterminate; }}
                      onChange={() => toggleCategory(category.id)}
                    />
                  </span>
                  <span className={styles.categoryName}>{category.name}</span>
                  <span className={styles.typeCount}>{types.length}</span>
                </label>

                {/* Type rows */}
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
                        <span>{type.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.applyBtn} onClick={onClose}>
            Применить {totalSelected > 0 && `(${totalSelected})`}
          </button>
        </div>
      </div>
    </>
  );
}
