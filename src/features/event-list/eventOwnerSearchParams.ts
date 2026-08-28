import type { IEventsSearchParams } from '@/entities/event';

/** Роль пользователя в мероприятии для фильтра поиска (API) */
export type EventOwnerScope = 'all' | 'organizer' | 'participant';

/** Вкладки мероприятий на странице пользователя */
export type UserEventsScope = 'all' | 'created' | 'participating';

export function eventOwnerSearchParams(
  scope: EventOwnerScope,
  accountId: string,
): Pick<IEventsSearchParams, 'organizatorId' | 'participantId'> {
  switch (scope) {
    case 'organizer':
      return { organizatorId: accountId };
    case 'participant':
      return { participantId: accountId };
    case 'all':
    default:
      return { organizatorId: accountId, participantId: accountId };
  }
}

export function userEventsScopeToOwnerScope(scope: UserEventsScope): EventOwnerScope {
  switch (scope) {
    case 'created':
      return 'organizer';
    case 'participating':
      return 'participant';
    case 'all':
    default:
      return 'all';
  }
}
