export interface Subscription{
    id: string;
    subscriberId: string;
    subscriberToId: string;
    notifyParticipated: boolean | null;
    notifyEventCreated: boolean | null;
    notifySubscribed: boolean | null;
}