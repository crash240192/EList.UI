// shared/lib/eventRatingGrade.ts

export type EventRatingGrade = { label: string; color: string; rot: number };

/** Средняя оценка мероприятия (дробное значение) */
export function getEventRatingGrade(score: number): EventRatingGrade {
  if (score >= 4.99) return { label: 'A++', color: '#16a34a', rot: -7 };
  if (score >= 4.95) return { label: 'A+',  color: '#22c55e', rot: -5 };
  if (score >= 4.7)  return { label: 'A',   color: '#4ade80', rot: -3 };
  if (score >= 4.0)  return { label: 'B',   color: '#3b82f6', rot:  4 };
  if (score >= 3.0)  return { label: 'C',   color: '#f59e0b', rot: -6 };
  if (score >= 2.0)  return { label: 'D',   color: '#f97316', rot:  3 };
  if (score >= 1.0)  return { label: 'F',   color: '#ef4444', rot: -8 };
  return               { label: 'F−', color: '#dc2626', rot:  5 };
}

/** Оценка пользователя (целое 1–5) */
export function getEventRatingSimpleGrade(score: number): EventRatingGrade {
  if (score >= 5) return { label: 'A', color: '#4ade80', rot: -3 };
  if (score >= 4) return { label: 'B', color: '#3b82f6', rot:  4 };
  if (score >= 3) return { label: 'C', color: '#f59e0b', rot: -6 };
  if (score >= 2) return { label: 'D', color: '#f97316', rot:  3 };
  return                { label: 'F', color: '#ef4444', rot: -8 };
}
