import type { IMessage } from '@/entities/conversation';
import { getVisualViewportBottomInset } from '@/shared/lib/useVisualViewportBottomInset';
import { LONG_MESSAGE_CHAR_THRESHOLD, LONG_MESSAGE_LINE_CLAMP } from './discussionUiConstants';

export const discussionMessageDomId = (messageId: string) => `discussion-msg-${messageId}`;

/** Сообщение достаточно видно во viewport (для завершения deep-link скролла) */
export function isDiscussionMessageInView(
  messageId: string,
  options?: { minVisiblePx?: number },
): boolean {
  const el = document.getElementById(discussionMessageDomId(messageId));
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const vv = window.visualViewport;
  const viewTop = vv?.offsetTop ?? 0;
  const viewBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  const visible = Math.min(rect.bottom, viewBottom) - Math.max(rect.top, viewTop);
  const minVisible = options?.minVisiblePx ?? Math.min(64, Math.max(24, rect.height * 0.45));
  return visible >= minVisible;
}

/** Длительность плавной, но быстрой перемотки к комментарию из уведомления */
export const DISCUSSION_FOCUS_SCROLL_DURATION_MS = 420;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

type FocusScrollAnimation = { raf: number; cancelled: boolean };

let activeFocusScroll: FocusScrollAnimation | null = null;

function cancelActiveFocusScroll(): void {
  if (!activeFocusScroll) return;
  activeFocusScroll.cancelled = true;
  cancelAnimationFrame(activeFocusScroll.raf);
  activeFocusScroll = null;
}

function clampScrollTop(maxScroll: number, top: number): number {
  return Math.max(0, Math.min(maxScroll, top));
}

/**
 * Плавная быстрая прокрутка к центру элемента (window или ближайший scroll-parent).
 * Длительность фиксированная — не зависит от расстояния, в отличие от native smooth.
 */
function animateScrollElementIntoCenter(
  el: HTMLElement,
  durationMs: number,
): Promise<void> {
  cancelActiveFocusScroll();

  const scrollParent = findScrollParent(el);
  const useWindow = !scrollParent;
  const start = useWindow
    ? window.scrollY
    : scrollParent!.scrollTop;

  const elRect = el.getBoundingClientRect();
  let target: number;
  if (useWindow) {
    const vv = window.visualViewport;
    const viewH = vv?.height ?? window.innerHeight;
    const viewTop = vv?.offsetTop ?? 0;
    target = window.scrollY + (elRect.top - viewTop) - viewH / 2 + elRect.height / 2;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - viewH);
    target = clampScrollTop(maxScroll, target);
  } else {
    const parentRect = scrollParent!.getBoundingClientRect();
    target = scrollParent!.scrollTop + (elRect.top - parentRect.top)
      - scrollParent!.clientHeight / 2 + elRect.height / 2;
    const maxScroll = scrollParent!.scrollHeight - scrollParent!.clientHeight;
    target = clampScrollTop(maxScroll, target);
  }

  const delta = target - start;
  if (Math.abs(delta) < 2) {
    return Promise.resolve();
  }

  // Короткий путь — чуть быстрее; дальние — не дольше durationMs
  const distance = Math.abs(delta);
  const duration = Math.min(
    durationMs,
    Math.max(220, Math.round(durationMs * (0.55 + Math.min(1, distance / 1400) * 0.45))),
  );

  const animation: FocusScrollAnimation = { raf: 0, cancelled: false };
  activeFocusScroll = animation;
  const t0 = performance.now();

  return new Promise((resolve) => {
    const tick = (now: number) => {
      if (animation.cancelled) {
        resolve();
        return;
      }
      const t = Math.min(1, (now - t0) / duration);
      const y = start + delta * easeOutCubic(t);
      if (useWindow) {
        window.scrollTo(0, y);
      } else {
        scrollParent!.scrollTop = y;
      }
      if (t < 1) {
        animation.raf = requestAnimationFrame(tick);
      } else {
        if (activeFocusScroll === animation) activeFocusScroll = null;
        resolve();
      }
    };
    animation.raf = requestAnimationFrame(tick);
  });
}

/** Прокрутка к комментарию (deep-link из уведомления) — плавная и быстрая */
export function scrollDiscussionMessageIntoView(
  messageId: string,
  options?: {
    behavior?: ScrollBehavior;
    block?: ScrollLogicalPosition;
    durationMs?: number;
  },
): boolean {
  const el = document.getElementById(discussionMessageDomId(messageId));
  if (!el) return false;

  // Deep-link: своя анимация. Legacy `behavior` оставляем для прочих вызовов.
  if (options?.behavior === 'auto') {
    el.scrollIntoView({
      behavior: 'auto',
      block: options?.block ?? 'center',
    });
    return true;
  }

  void animateScrollElementIntoCenter(
    el,
    options?.durationMs ?? DISCUSSION_FOCUS_SCROLL_DURATION_MS,
  );
  return true;
}

/**
 * Повторные попытки прокрутки к сообщению.
 * onDone — только когда элемент реально в зоне видимости (не по факту существования в DOM).
 */
export function scheduleDiscussionMessageFocusScroll(
  messageId: string,
  options: {
    isCancelled?: () => boolean;
    onDone?: () => void;
    delaysMs?: number[];
    durationMs?: number;
  },
): () => void {
  const delays = options.delaysMs ?? [40, 180, 420, 900, 1600, 2800];
  const durationMs = options.durationMs ?? DISCUSSION_FOCUS_SCROLL_DURATION_MS;
  let done = false;
  let started = false;

  const finishIfVisible = () => {
    if (done || options.isCancelled?.()) return;
    if (!isDiscussionMessageInView(messageId)) return;
    done = true;
    options.onDone?.();
  };

  const attempt = () => {
    if (done || options.isCancelled?.()) return;
    const el = document.getElementById(discussionMessageDomId(messageId));
    if (!el) return;

    // Уже в кадре — не дёргаем повторной анимацией
    if (isDiscussionMessageInView(messageId)) {
      done = true;
      options.onDone?.();
      return;
    }

    if (started && activeFocusScroll && !activeFocusScroll.cancelled) {
      // Дождаться текущей анимации, потом проверить
      return;
    }

    started = true;
    void animateScrollElementIntoCenter(el, durationMs).then(() => {
      started = false;
      // Кадр после отрисовки — layout мог ещё догрузиться
      requestAnimationFrame(() => {
        window.setTimeout(finishIfVisible, 32);
      });
    });
  };

  const raf = requestAnimationFrame(() => attempt());
  const timers = delays.map((ms) => window.setTimeout(() => attempt(), ms));

  return () => {
    done = true;
    cancelAnimationFrame(raf);
    timers.forEach((id) => window.clearTimeout(id));
    cancelActiveFocusScroll();
  };
}

const DEFAULT_COMPOSER_HEIGHT = 180;
const MOBILE_COMPOSER_HEIGHT_ESTIMATE = 140;
const REPLY_GAP_PX = 16;
const NARROW_REPLY_MEDIA = '(max-width: 639px)';

export function isNarrowReplyViewport(): boolean {
  return window.matchMedia(NARROW_REPLY_MEDIA).matches;
}

/** Верхний отступ при прокрутке — чтобы комментарий не уезжал за край экрана */
export function getReplyScrollTopGap(): number {
  return isNarrowReplyViewport() ? 56 : 16;
}

export function getDefaultComposerHeightEstimate(): number {
  return isNarrowReplyViewport() ? MOBILE_COMPOSER_HEIGHT_ESTIMATE : DEFAULT_COMPOSER_HEIGHT;
}

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
  const narrow = isNarrowReplyViewport();
  const minTail = narrow
    ? Math.max(reserveBottomPx + 48, 96)
    : Math.max(reserveBottomPx + 72, 180);

  if (!el) return narrow ? minTail : Math.max(minTail, 280);

  const targetBottom = getVisibleViewportBottom() - reserveBottomPx - gap;
  const deficit = el.getBoundingClientRect().bottom - targetBottom;

  if (deficit <= 0) {
    return minTail;
  }

  return Math.ceil(deficit + (narrow ? 72 : 96));
}

/**
 * Прокручивает комментарий так, чтобы он целиком был над формой ввода.
 * @returns false, если прокрутить не удалось (нужен больший нижний отступ)
 */
export function scrollMessageIntoViewForReply(
  messageId: string,
  reserveBottomPx: number,
  options?: { gap?: number; topGap?: number; behavior?: ScrollBehavior },
): boolean {
  const el = document.getElementById(discussionMessageDomId(messageId));
  if (!el) return false;

  const gap = options?.gap ?? REPLY_GAP_PX;
  const topGap = options?.topGap ?? getReplyScrollTopGap();
  const behavior = options?.behavior ?? 'smooth';
  const bandTop = getVisibleViewportTop() + topGap;
  const bandBottom = getVisibleViewportBottom() - reserveBottomPx - gap;
  const elRect = el.getBoundingClientRect();

  if (elRect.top >= bandTop && elRect.bottom <= bandBottom) {
    return true;
  }

  let delta = 0;

  if (elRect.bottom > bandBottom) {
    delta = elRect.bottom - bandBottom;
    const maxUpward = Math.max(0, elRect.top - bandTop);
    if (delta > maxUpward) {
      delta = maxUpward;
    }
  } else if (elRect.top < bandTop) {
    delta = elRect.top - bandTop;
  }

  if (Math.abs(delta) < 2) {
    return elRect.bottom <= bandBottom + 2;
  }

  const scrollParent = findScrollParent(el);
  if (!scrollParent) {
    el.scrollIntoView({ block: 'nearest', behavior });
    return true;
  }

  const maxScrollTop = scrollParent.scrollHeight - scrollParent.clientHeight;
  const requestedTop = scrollParent.scrollTop + delta;
  const nextTop = Math.max(0, Math.min(maxScrollTop, requestedTop));

  if (Math.abs(nextTop - scrollParent.scrollTop) < 1) {
    return elRect.bottom <= bandBottom + 2;
  }

  scrollParent.scrollTo({ top: nextTop, behavior });

  if (requestedTop > maxScrollTop + 1 && elRect.bottom > bandBottom) {
    return false;
  }

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

export function isLongMessageText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.split('\n').length > LONG_MESSAGE_LINE_CLAMP) return true;
  return trimmed.length > LONG_MESSAGE_CHAR_THRESHOLD;
}

/** Корневые комментарии (без replyTo) — ответы подгружаются отдельным методом */
export function filterRootMessages(items: IMessage[]): IMessage[] {
  return items.filter((m) => !m.replyTo);
}

/** Сообщение можно удалить, если на него ещё нет ответов */
export function canDeleteMessage(
  message: IMessage,
  replyBump: number,
  replyTotal: number | null,
): boolean {
  if (replyTotal != null) return replyTotal === 0;
  if (message.replied || replyBump > 0) return false;
  return true;
}

export function messageHasReplies(
  message: IMessage,
  replyBump: number,
  replyTotal: number | null,
): boolean {
  if (replyBump > 0) return true;
  if (replyTotal === 0) return false;
  if (replyTotal != null) return replyTotal > 0;
  return message.replied;
}
