import { Account } from "../api/models/Account/Account";
import { ContactType } from "../api/models/Contacts/ContactType";
import { EventCategory } from "../api/models/Events/Categories/EventCategory";
import { Event } from "../api/models/Events/Event";
import { EventType } from "../api/models/Events/Types/EventType";
import { PersonInfo } from "../api/models/PersonInfo/PersonInfo";

export interface AuthState {
    token: string | null;
    activationRequired: boolean | null;
}

export interface AccountState{
    currentAccount: Account | null,
    accounts: Account[] | null,
    account: Account | null
}

export interface ContactsState {
    contactTypes: ContactType[] | null;
}

export interface PersonInfoState{
    currentPersonInfo: PersonInfo | null
    personInfo: PersonInfo | null
    personInfos: PersonInfo[] | null
}

export interface EventsState{
    eventTypes: EventType[] | null,
    eventCategories: EventCategory[] | null,
    selectedEventTypes: EventType[] | null,
    selectedEventCategories: EventCategory[] | null,
    currentEvent: Event | null,
    actualEvents: Event[] | null,
    events: Event[] | null,
    finishedEvents: Event[] | null
}

export interface SystemState{
    viewMode: string | null
}