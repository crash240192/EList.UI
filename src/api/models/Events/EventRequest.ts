import { EventParametersRequest } from "./Parameters/EventParametersRequest";

export interface EventRequest{
    startTime: Date;
    endTime: Date;
    name: string;
    //location:
    address: string;
    active: boolean;
    eventParameters: EventParametersRequest | null;
    eventTypes: string[];
    organizatorAccountIds: string[];
    organizatorOrganizationIds: string[];
}