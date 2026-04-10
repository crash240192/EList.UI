import { EventCategory } from "../Categories/EventCategory";

export interface EventType{
    id: string;
    name: string;
    namePath: string;
    description: string;
    ico: string;
    eventCategoryId: string;
}