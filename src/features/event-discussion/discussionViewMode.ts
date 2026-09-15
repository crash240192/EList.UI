/** Режим отображения ответов: полное дерево или двухуровневая лента (как YouTube). */

export type DiscussionViewMode = 'tree' | 'flat';

export const DISCUSSION_VIEW_MODE_STORAGE_KEY = 'elist.discussion.viewMode';

/** После этой глубины в дереве отступы больше не накапливаются */
export const DISCUSSION_TREE_INDENT_CAP = 4;

/**
 * Сколько прямых ответов родителя показывать сразу;
 * остальные — кнопкой «Ещё ответы к этому комментарию».
 * В дереве — на каждом уровне; в ленте — под корнем.
 */
export const DISCUSSION_REPLY_PREVIEW_COUNT = 1;

/** @deprecated alias — то же, что DISCUSSION_REPLY_PREVIEW_COUNT */
export const DISCUSSION_FLAT_REPLY_PREVIEW_COUNT = DISCUSSION_REPLY_PREVIEW_COUNT;

/** Размер страницы догрузки прямых детей в дереве */
export const DISCUSSION_TREE_SIBLING_PAGE_SIZE = 5;

export const DISCUSSION_VIEW_MODE_LABELS: Record<DiscussionViewMode, string> = {
  tree: 'Дерево',
  flat: 'Лента',
};

export function isDiscussionViewMode(value: unknown): value is DiscussionViewMode {
  return value === 'tree' || value === 'flat';
}
