/** Русские формы числительных для UI. */

function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const mod10 = abs % 10;
  if (abs >= 11 && abs <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/** 1 человек / 2 человека / 5 человек */
export function pluralPeople(n: number): string {
  return pluralRu(n, 'человек', 'человека', 'человек');
}

/** «12 человек» */
export function formatPeopleCount(n: number): string {
  return `${n} ${pluralPeople(n)}`;
}

/** 1 подписчик / 2 подписчика / 5 подписчиков */
export function pluralSubscribers(n: number): string {
  return pluralRu(n, 'подписчик', 'подписчика', 'подписчиков');
}

export function formatSubscribersCount(n: number): string {
  return `${n} ${pluralSubscribers(n)}`;
}

/** 1 обсуждение / 2 обсуждения / 5 обсуждений */
export function formatDiscussionsCount(n: number): string {
  return `${n} ${pluralRu(n, 'обсуждение', 'обсуждения', 'обсуждений')}`;
}
