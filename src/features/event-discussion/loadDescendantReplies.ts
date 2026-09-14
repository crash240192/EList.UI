import type { IMessage } from '@/entities/conversation';
import { fetchMessageReplies } from '@/entities/conversation';

const PAGE_SIZE = 20;
/** Защита от бесконечных/очень больших веток при клиентском обходе */
const MAX_DESCENDANTS = 200;

/**
 * Собирает всех потомков корня (BFS по прямым replyTo), сохраняя исходные replyTo.
 * Нужно для режима «лента», пока API отдаёт только прямых детей.
 */
export async function loadDescendantReplies(rootId: string): Promise<IMessage[]> {
  const out: IMessage[] = [];
  const seen = new Set<string>();
  const queue: string[] = [rootId];

  while (queue.length > 0 && out.length < MAX_DESCENDANTS) {
    const parentId = queue.shift()!;
    let pageIndex = 0;

    for (;;) {
      const page = await fetchMessageReplies(parentId, pageIndex, PAGE_SIZE);
      const items = page.result ?? [];
      const total = page.total ?? items.length;

      for (const item of items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        out.push(item);
        if (item.replied) queue.push(item.id);
        if (out.length >= MAX_DESCENDANTS) break;
      }

      if (out.length >= MAX_DESCENDANTS) break;
      if (items.length === 0 || (pageIndex + 1) * PAGE_SIZE >= total) break;
      pageIndex += 1;
    }
  }

  out.sort((a, b) => Date.parse(a.createDate) - Date.parse(b.createDate));
  return out;
}
