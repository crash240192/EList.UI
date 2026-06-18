import type { IMessage } from '@/entities/conversation';
import { getVisualViewportBottomInset } from '@/shared/lib/useVisualViewportBottomInset';

export const discussionMessageDomId = (messageId: string) => `discussion-msg-${messageId}`;

const DEFAULT_COMPOSER_HEIGHT = 220;
const REPLY_GAP_PX = 16;

export function findScrollParent(el: HTMLElement): HTMLElement | null {
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

export function getVisibleViewportTop(): number {
  return window.visualViewport?.offsetTop ?? 0;
}

export function getVisibleViewportBottom(): number {
  const vv = window.visualViewport;
  return vv ? vv.offsetTop + vv.height : window.innerHeight;
}

/** Зарезервированная высота снизу экрана: форма + клавиатура */
export function getReplyComposerReservePx(
  sheetHeight = DEFAULT_COMPOSER_HEIGHT,
  keyboardInset = getVisualViewportBottomInset(),
): number {
  const safeBottom = keyboardInset > 0 ? 8 : 12;
  return sheetHeight + keyboardInset + safeBottom;
}

/** Сколько пикселей добавить внизу ленты, чтобы прокрутить комментарий выше формы */
export function computeReplyScrollTailPx(
  messageId: string,
  reserveBottomPx: number,
  gap = REPLY_GAP_PX,
): number {
  const el = document.getElementById(discussionMessageDomId(messageId));
  const keyboardBuffer = Math.ceil(window.innerHeight * 0.38);

  if (!el) return Math.max(keyboardBuffer, 360);

  const targetBottom = getVisibleViewportBottom() - reserveBottomPx - gap;
  const deficit = el.getBoundingClientRect().bottom - targetBottom;

  if (deficit <= 0) {
    return Math.max(keyboardBuffer, 280);
  }

  return Math.ceil(deficit + 96);
}

/**
 * Прокручивает комментарий так, чтобы он целиком был над формой ввода.
 * @returns false, если прокрутить не удалось (нужен больший нижний отступ)
 */
export function scrollMessageIntoViewForReply(
  messageId: string,
  reserveBottomPx: number,
  options?: { gap?: number; behavior?: ScrollBehavior },
): boolean {
  const el = document.getElementById(discussionMessageDomId(messageId));
  if (!el) return false;

  const gap = options?.gap ?? REPLY_GAP_PX;
  const behavior = options?.behavior ?? 'smooth';
  const visibleTop = getVisibleViewportTop();
  const targetBottom = getVisibleViewportBottom() - reserveBottomPx - gap;
  const elRect = el.getBoundingClientRect();

  let delta = 0;
  if (elRect.bottom > targetBottom) {
    delta = elRect.bottom - targetBottom;
  } else if (elRect.top < visibleTop + gap) {
    delta = elRect.top - (visibleTop + gap);
  }

  if (Math.abs(delta) < 2) return true;

  const scrollParent = findScrollParent(el);
  if (!scrollParent) {
    el.scrollIntoView({ block: 'nearest', behavior });
    return true;
  }

  const maxScrollTop = scrollParent.scrollHeight - scrollParent.clientHeight;
  const nextTop = Math.max(0, Math.min(maxScrollTop, scrollParent.scrollTop + delta));

  if (Math.abs(nextTop - scrollParent.scrollTop) < 1) {
    return false;
  }

  scrollParent.scrollTo({ top: nextTop, behavior });
  return true;
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

export function formatReplyCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${count} ответов`;
  if (mod10 === 1) return `${count} ответ`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} ответа`;
  return `${count} ответов`;
}

/** Корневые комментарии (без replyTo) — ответы подгружаются отдельным методом */
export function filterRootMessages(items: IMessage[]): IMessage[] {
  return items.filter((m) => !m.replyTo);
}
