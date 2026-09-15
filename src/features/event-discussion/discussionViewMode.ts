/** Режим отображения ответов: полное дерево или двухуровневая лента (как YouTube). */

export type DiscussionViewMode = 'tree' | 'flat';

export const DISCUSSION_VIEW_MODE_STORAGE_KEY = 'elist.discussion.viewMode';

/** После этой глубины в дереве отступы больше не накапливаются */
export const DISCUSSION_TREE_INDENT_CAP = 4;

/** Сколько ответов показывать сразу под корневым комментарием */
export const DISCUSSION_REPLY_PREVIEW_COUNT = 1;

export const DISCUSSION_VIEW_MODE_LABELS: Record<DiscussionViewMode, string> = {
  tree: 'Дерево',
  flat: 'Лента',
};

export function isDiscussionViewMode(value: unknown): value is DiscussionViewMode {
  return value === 'tree' || value === 'flat';
}
