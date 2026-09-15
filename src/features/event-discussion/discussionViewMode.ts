/** Режим отображения ответов: полное дерево или двухуровневая лента (как YouTube). */

export type DiscussionViewMode = 'tree' | 'flat';

export const DISCUSSION_VIEW_MODE_STORAGE_KEY = 'elist.discussion.viewMode';

/** После этой глубины в дереве отступы больше не накапливаются */
export const DISCUSSION_TREE_INDENT_CAP = 4;

/**
 * Сколько прямых ответов родителя показывать сразу;
 * остальные — кнопкой «Ещё ответы к этому комментарию».
 * (И для дерева на каждом уровне, и для превью ленты под корнем.)
 */
export const DISCUSSION_REPLY_PREVIEW_COUNT = 1;

/** Размер страницы догрузки прямых детей в дереве */
export const DISCUSSION_TREE_SIBLING_PAGE_SIZE = 5;

export const DISCUSSION_VIEW_MODE_LABELS: Record<DiscussionViewMode, string> = {
  tree: 'Дерево',
  flat: 'Лента',
};

export function isDiscussionViewMode(value: unknown): value is DiscussionViewMode {
  return value === 'tree' || value === 'flat';
}
