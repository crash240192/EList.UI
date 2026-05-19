import type { IMessage } from '@/entities/conversation';

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
