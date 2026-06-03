// entities/invitation/invitationViewed.ts

/** viewed === false — приглашение ещё не просмотрено */
export function parseInvitationViewed(raw: unknown): boolean {
  if (raw === false || raw === 0 || raw === 'false') return false;
  if (raw === true || raw === 1 || raw === 'true') return true;
  return true;
}

export function isInvitationUnviewed(inv: { viewed: boolean }): boolean {
  return inv.viewed === false;
}
