import { Dispatch } from "@reduxjs/toolkit";
import { EventCategory } from "../../api/models/Events/Categories/EventCategory";
import { EventType } from "../../api/models/Events/Types/EventType";
import { EventsState } from "../types";
import { requestsRepository } from "../../api/RequestsRepository";
import { EventsSearchRequest } from "../../api/models/Events/EventsSearchRequest";
import { Event } from "../../api/models/Events/Event";

const SET_EVENT_TYPES = "SET_EVENT_TYPES";
const ADD_SELECTED_EVENT_TYPE = "ADD_SELECTED_EVENT_TYPE";
const DROP_SELECTED_EVENT_TYPE = "DROP_SELECTED_EVENT_TYPE";

const SET_SELECTED_EVENT_TYPES = "SET_SELECTED_EVENT_TYPES";
const SET_EVENT_CATEGORIES = "SET_EVENT_CATEGORIES";

const SET_ACTUAL_EVENTS = "SET_ACTUAL_EVENTS";
const SET_EVENTS = "SET_EVENTS";
const SET_FINISHED_EVENTS="SET_FINISHED_EVENTS"

let initialState: EventsState = {
    eventTypes: null,
    eventCategories: null,
    selectedEventTypes: null,
    selectedEventCategories: null,
    currentEvent: null,
    actualEvents: null,
    events: null,
    finishedEvents: null
}

export default function EventsReducer(state = initialState, action: EventActions){
    switch(action.type){
        case SET_EVENT_TYPES: return {...state, eventTypes: action.eventTypes}
        case SET_EVENT_CATEGORIES: return {...state, eventCategories: action.eventCategories}
        case ADD_SELECTED_EVENT_TYPE:{
            let curSelectedEventTypes = state.selectedEventTypes;
            if (!curSelectedEventTypes)            
                curSelectedEventTypes = [action.eventType]
            else {
                let existingEventType = curSelectedEventTypes?.find(i => i.id === action.eventType.id)
                if (!existingEventType)
                    curSelectedEventTypes.push(action.eventType);
            }
            let newState = {...state, selectedEventTypes: curSelectedEventTypes};
            return newState;
        }
        case DROP_SELECTED_EVENT_TYPE:{
            let curSelectedEventTypes = state.selectedEventTypes;
            if (curSelectedEventTypes)
            {
                let existingEventType = curSelectedEventTypes?.find(i => i.id === action.eventType.id)
                if (existingEventType){
                    let index = curSelectedEventTypes.indexOf(existingEventType);
                    if (index > -1)
                        curSelectedEventTypes.splice(index,1)
                }
            }
            let newState = {...state, selectedEventTypes: curSelectedEventTypes};
            return newState;
        }
        default: return state;
    }
}

type EventActions = SetEventTypes | SetEventCategories | SetSelectedEventTypes | AddSelectedEventType | DropSelectedEventType;

interface SetEventTypes{
    type: typeof SET_EVENT_TYPES,
    eventTypes: EventType[] | null
}

interface SetEventCategories{
    type: typeof SET_EVENT_CATEGORIES,
    eventCategories: EventCategory[] | null
}

interface SetSelectedEventTypes{
    type: typeof SET_SELECTED_EVENT_TYPES,
    selectedEventTypes: EventType[] | null
}

interface AddSelectedEventType{
    type: typeof ADD_SELECTED_EVENT_TYPE,
    eventType: EventType | null
}

interface DropSelectedEventType{
    type: typeof DROP_SELECTED_EVENT_TYPE,
    eventType: EventType | null
}

interface SetEvents{
    type: typeof SET_EVENTS,
    events: Event[] | null
}

function setEventTypes(eventTypes: EventType[]){
    return {
        type: SET_EVENT_TYPES,
        eventTypes
    }
}

function setEventCategories(eventCategories: EventCategory[]){
    return {
        type: SET_EVENT_CATEGORIES,
        eventCategories
    }
}

function setEvents(events: Event[]){
    return {
        type: SET_EVENTS,
        events
    }
}

export function addSelectedEventType(eventType: EventType){
    return{
        type: ADD_SELECTED_EVENT_TYPE,
        eventType
    }
}

export function dropSelectedEventType(eventType: EventType){
    return{
        type: DROP_SELECTED_EVENT_TYPE,
        eventType
    }
}

export function loadAllEventTypes(): any{
    return function(dispatch: Dispatch){
        requestsRepository.EventsApiService.getAllTypes()
        .then((response) =>{
            if (response.success)
                dispatch(setEventTypes(response.result))
        })
    }
}

export function loadAllEventCategories(): any{
    return function(dispatch: Dispatch){
        requestsRepository.EventsApiService.getAllCategories()
        .then((response) =>{
            if (response.success)
                dispatch(setEventCategories(response.result))
        })
    }
}


export function loadGlobalEvents(request: EventsSearchRequest): any{
    return function (dispatch: Dispatch){
        debugger;
        requestsRepository.EventsApiService.searchEvents(request)
        .then((response) =>{
            debugger;
            if (response.success)
            {
                debugger;
                dispatch(setEvents(response.result.result))
            }
        })
    }
}