import { AccountApiService } from "./AccoutApiService";
import { AuthApiService } from "./AuthApiService";
import { ContactsApiService } from "./ContactsApiService";
import EventsApiService from "./EventsApiService";
import { PersonInfoApiService } from "./PersonInfoApiService";
import { SubscriptionsApiService } from "./SubscriptionsApiService";

class RequestsRepository {
    AuthApiService = new AuthApiService();
    ContactsApiService = new ContactsApiService();
    AccountApiService = new AccountApiService();
    PersonInfoApiService = new PersonInfoApiService();
    SubscriptionsApiService = new SubscriptionsApiService();
    EventsApiService = new EventsApiService();
}

export const requestsRepository = new RequestsRepository();

export function resetRequestsRepository(token?: string){
    requestsRepository.AuthApiService = new AuthApiService(token);
    requestsRepository.ContactsApiService = new ContactsApiService(token);
    requestsRepository.AccountApiService = new AccountApiService(token);
    requestsRepository.PersonInfoApiService = new PersonInfoApiService(token);
    requestsRepository.SubscriptionsApiService = new SubscriptionsApiService(token);
    requestsRepository.EventsApiService = new EventsApiService(token);
}