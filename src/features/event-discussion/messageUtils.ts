import type { IMessage } from '@/entities/conversation';

export const discussionMessageDomId = (messageId: string) => `discussion-msg-${messageId}`;

const DEFAULT_COMPOSER_HEIGHT = 220;

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let parent = el.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

/** Центрирует комментарий в видимой области над выезжающей формой */
export function scrollMessageIntoViewForReply(
  messageId: string,
  composerHeight = DEFAULT_COMPOSER_HEIGHT,
) {
  const el = document.getElementById(discussionMessageDomId(messageId));
  if (!el) return;

  const scrollParent = findScrollParent(el);
  if (!scrollParent) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }

  const elRect = el.getBoundingClientRect();
  const parentRect = scrollParent.getBoundingClientRect();
  const bandHeight = Math.max(120, parentRect.height - composerHeight);
  const targetCenterY = parentRect.top + bandHeight * 0.5;
  const elCenterY = elRect.top + elRect.height / 2;
  const delta = elCenterY - targetCenterY;

  if (Math.abs(delta) < 4) return;
  scrollParent.scrollBy({ top: delta, behavior: 'smooth' });
}

export function messageInitials(msg: IMessage): string {
  const first = msg.personInfo?.firstName?.trim() ?? '';
  const last = msg.personInfo?.lastName?.trim() ?? '';
  const login = msg.account?.login?.trim() ?? '';
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first[0].toUpperCase();
  if (login) return login[0].toUpperCase();
  return '?';
}

export function messageAuthorName(msg: IMessage): string {
  const first = msg.personInfo?.firstName?.trim() ?? '';
  const last = msg.personInfo?.lastName?.trim() ?? '';
  if (first || last) return `${first} ${last}`.trim();
  return msg.account?.login?.trim() || 'Участник';
}

export function formatMessageDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/** Корневые комментарии (без replyTo) — ответы подгружаются отдельным методом */
export function filterRootMessages(items: IMessage[]): IMessage[] {
  return items.filter((m) => !m.replyTo);
}
