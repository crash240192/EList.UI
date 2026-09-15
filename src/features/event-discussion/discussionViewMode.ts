/** Режим отображения ответов: полное дерево или двухуровневая лента (как YouTube). */

export type DiscussionViewMode = 'tree' | 'flat';

export const DISCUSSION_VIEW_MODE_STORAGE_KEY = 'elist.discussion.viewMode';

/** После этой глубины в дереве отступы больше не накапливаются */
export const DISCUSSION_TREE_INDENT_CAP = 4;

/**
 * В ленте под корнем сразу показываем столько ответов;
 * остальные — за кнопкой «Ещё ответы».
 */
export const DISCUSSION_FLAT_REPLY_PREVIEW_COUNT = 1;

/**
 * В дереве автоматически раскрываем вложенные ветки до этой глубины
 * (цепочка диалога без клика на каждый уровень, как на Пикабу).
 */
export const DISCUSSION_TREE_AUTO_EXPAND_DEPTH = 12;

export const DISCUSSION_VIEW_MODE_LABELS: Record<DiscussionViewMode, string> = {
  tree: 'Дерево',
  flat: 'Лента',
};

export function isDiscussionViewMode(value: unknown): value is DiscussionViewMode {
  return value === 'tree' || value === 'flat';
}
