/** Режим отображения ответов: полное дерево или двухуровневая лента (как YouTube). */

export type DiscussionViewMode = 'tree' | 'flat';

export const DISCUSSION_VIEW_MODE_STORAGE_KEY = 'elist.discussion.viewMode';

/** После этой глубины в дереве отступы больше не накапливаются */
export const DISCUSSION_TREE_INDENT_CAP = 4;

/**
 * Сколько прямых ответов родителя показывать сразу в ленте под корнем;
 * остальные — за пагинацией/кнопкой.
 */
export const DISCUSSION_REPLY_PREVIEW_COUNT = 1;

/** @deprecated alias */
export const DISCUSSION_FLAT_REPLY_PREVIEW_COUNT = DISCUSSION_REPLY_PREVIEW_COUNT;

/** Размер страницы корневых комментариев */
export const DISCUSSION_ROOT_PAGE_SIZE = 10;

/** Размер страницы прямых детей (сиблингов) в дереве */
export const DISCUSSION_TREE_SIBLING_PAGE_SIZE = 5;

export const DISCUSSION_VIEW_MODE_LABELS: Record<DiscussionViewMode, string> = {
  tree: 'Дерево',
  flat: 'Лента',
};

export function isDiscussionViewMode(value: unknown): value is DiscussionViewMode {
  return value === 'tree' || value === 'flat';
}

export function discussionTotalPages(total: number, pageSize: number): number {
  if (pageSize <= 0 || total <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}
