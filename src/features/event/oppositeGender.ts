import type { Gender } from '@/shared/api/types';
import { fetchFullProfile } from '@/entities/user/profileApi';

export function isOppositeEventGender(
  userGender: Gender | null | undefined,
  eventGender: Gender | null | undefined,
): boolean {
  if (userGender !== 'Male' && userGender !== 'Female') return false;
  if (eventGender !== 'Male' && eventGender !== 'Female') return false;
  return userGender !== eventGender;
}

/** true, если у мероприятия есть ограничение и пол текущего пользователя ему не соответствует. */
export async function myGenderConflictsWith(
  eventGender: Gender | null | undefined,
): Promise<boolean> {
  if (eventGender !== 'Male' && eventGender !== 'Female') return false;
  const profile = await fetchFullProfile(null);
  const person = profile.person as { gender?: unknown; Gender?: unknown } | null;
  const raw = person?.gender ?? person?.Gender;
  const mine: Gender | null = raw === 'Female' || raw === 'Male' ? raw : null;
  return isOppositeEventGender(mine, eventGender);
}
