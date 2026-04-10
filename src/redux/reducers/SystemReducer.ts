import { SystemState } from "../types";
import { Dispatch } from "@reduxjs/toolkit";

const MAP_MODE = 'map';
const LIST_MODE = 'list';
const PANEL_MODE = "panels";
const SET_VIEW_MODE = 'SET_VIEW_MODE'

let systemInitState: SystemState = {
    viewMode: 'map',
}

export default function SystemReducer(state = systemInitState, action: SystemActionTypes) {
    switch (action.type) {
        case (SET_VIEW_MODE): {
            return { ...state, viewMode: action.viewMode }
        }
        default: return state;
    }
}


type SystemActionTypes = SetMapMode | SetListMode | SetPanelMode;

interface SetMapMode {
    type: typeof SET_VIEW_MODE
    viewMode: typeof MAP_MODE
}

interface SetListMode {
    type: typeof SET_VIEW_MODE
    viewMode: typeof LIST_MODE
}

interface SetPanelMode {
    type: typeof SET_VIEW_MODE
    viewMode: typeof PANEL_MODE
}


function setMapMode() {
    return { type: SET_VIEW_MODE, viewMode: MAP_MODE };
}

function setListMode() {
    return { type: SET_VIEW_MODE, viewMode: LIST_MODE };
}

function setPanelMode() {
    return { type: SET_VIEW_MODE, viewMode: PANEL_MODE };
}

export function SetViewMode(viewMode: string): any {
    return function (dispatch: Dispatch) {
        switch (viewMode) {
            case MAP_MODE: { dispatch(setMapMode()); return; }
            case LIST_MODE: { dispatch(setListMode()); return; }
            case PANEL_MODE: { dispatch(setPanelMode()); return; }
            default:
                return null;
        }
    }
}