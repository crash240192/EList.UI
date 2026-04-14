// entities/event/index.ts — публичный API сущности Event

export type {
  IEvent,
  IEventCategory,
  IEventType,
  //IEventParameters,
  IEventsSearchParams,
  ICreateEventRequest,
  IEventParametersRequest,
  IEventPagedList,
  EventViewMode,
  ParticipationStatus,
} from './types';

export {
  fetchEvents,
  fetchEventsMock,
  fetchEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  startEvent,
  finishEvent,
  //fetchEventParameters,
  updateEventParameters,
  fetchEventCategories,
  fetchEventTypes,
  MOCK_EVENTS,
} from './api';

export { EventCard } from './ui/EventCard';

export {
  participateEvent,
  leaveEvent,
  fetchEventParticipants,
} from './participationApi';

export type { IParticipant, IParticipantView, IParticipantAccount, IParticipantPersonInfo } from './participationApi';

export {
  fetchEventParameters,
  fetchEventOrganizators,
} from './eventExtrasApi';

export type { IEventParameters, IEventOrganizator } from './eventExtrasApi';
