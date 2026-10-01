// shared/lib/concurrencyLimit.ts
// Очередь промисов с лимитом одновременных задач (анти-flood fetch/img).

/**
 * Возвращает обёртку: не больше `limit` задач одновременно, остальные ждут в FIFO.
 */
export function createConcurrencyLimiter(limit: number): <T>(fn: () => Promise<T>) => Promise<T> {
  let active = 0;
  const queue: Array<() => void> = [];

  const pump = () => {
    while (active < limit && queue.length > 0) {
      const start = queue.shift();
      if (!start) break;
      start();
    }
  };

  return function runLimited<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        active += 1;
        fn().then(resolve, reject).finally(() => {
          active -= 1;
          pump();
        });
      };
      queue.push(start);
      pump();
    });
  };
}
