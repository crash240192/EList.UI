import { BaseRequest } from "./BaseRequest";
import { ICommandResult } from "./models/CommandResult";
import { EventCategory } from "./models/Events/Categories/EventCategory";
import { Event } from "./models/Events/Event";
import { EventsSearchRequest } from "./models/Events/EventsSearchRequest";
import { EventType } from "./models/Events/Types/EventType";
import { PagedList } from "./models/PagedList";

export default class EventsApiService extends BaseRequest{
    getAllTypes(config?: string) : Promise<ICommandResult<EventType[]>>{
        return this.fetchAPI( `/events/eventTypes/getAll`,
            Object.assign({method: 'GET'}, config)).catch(BaseRequest.handleError)
    }

    getAllCategories(config?: string) : Promise<ICommandResult<EventCategory[]>>{
        return this.fetchAPI( `/events/eventCategories/getAll`,
            Object.assign({method: 'GET'}, config)).catch(BaseRequest.handleError)
    }

    searchEvents(request: EventsSearchRequest, config?: string) : Promise<ICommandResult<PagedList<Event[]>>>{
        return this.fetchAPI( 'events/search',
            Object.assign({method: "POST", body: JSON.stringify({...request})}, config))
                .catch(BaseRequest.handleError)
    }
}