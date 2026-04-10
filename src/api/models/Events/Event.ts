import { EventParameters } from "./Parameters/EventParameters"

export interface Event{
    id: string,
    startTime: Date,
    endTime: Date,
    name: string | null,
    latitude: number,
    longitude: number,
    description: string,
    address: string,
    active: boolean,
    eventParametersId: string | null,
    eventParameters: EventParameters | null,
    eventTypeIds: string[] | null,
    creationDate: Date,
    updateDate: Date
}