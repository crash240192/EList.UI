import { BaseRequest } from "./BaseRequest";
import { CommandResult, ICommandResult } from "./models/CommandResult";
import { UpdateSubscriptionRequest } from "./models/Subscriptions/Requests/UpdateSubscriptionRequest";
import { Subscription } from "./models/Subscriptions/Subscription";

export class SubscriptionsApiService extends BaseRequest{
    getSubscriptions(config?: string): Promise<ICommandResult<Subscription[]>>{
        return this.fetchAPI('/subscriptions/getSubscriptions',
            Object.assign({method:"GET"}, config)
        ).catch(BaseRequest.handleError)
    }

    deleteSubscription(id: string, config?: string): Promise<CommandResult>{
        return this.fetchAPI(`/subscriptions/deleteSubscription/${id}`,
            Object.assign({method:"DELETE"}, config)
        ).catch(BaseRequest.handleError)
    }

    getSubscribers(config?: string): Promise<ICommandResult<Subscription[]>>{
        return this.fetchAPI('/subscriptions/getSubscribers',
            Object.assign({method:"GET"}, config)
        ).catch(BaseRequest.handleError)
    }

    subscribe(id: string, config?: string): Promise<CommandResult>{
        return this.fetchAPI(`/subscriptions/subscribe/${id}`,
            Object.assign({method:"GET"}, config)
        ).catch(BaseRequest.handleError)
    }

    updateSubscription(id: string, subscriptionConfig: UpdateSubscriptionRequest, config?: string): Promise<CommandResult>{
        return this.fetchAPI(`/subscriptions/subscribe/${id}`,
            Object.assign({method:"PUT", body:JSON.stringify({notifyParticipated: subscriptionConfig.notifyParticipated,
                notifyEventCreated: subscriptionConfig.notifyEventCreated,
                notifySubscribed: subscriptionConfig.notifySubscribed
            })}, config)
        ).catch(BaseRequest.handleError)
    }
}