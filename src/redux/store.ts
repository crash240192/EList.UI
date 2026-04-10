import { combineReducers, legacy_createStore as createStore, applyMiddleware, compose } from "redux";
import { thunk } from "redux-thunk";
import { AccountState, AuthState, ContactsState, EventsState, PersonInfoState, SystemState } from "./types";
import { AuthReducer } from "./reducers/AuthReducer";
import { ContactsReducer } from "./reducers/ContactsReducer";
import { AccountReducer } from "./reducers/AccountsReducer";
import PersonInfoReducer from "./reducers/PersonInfo";
import EventsReducer from "./reducers/EventsReducer";
import  SystemReducer from "./reducers/SystemReducer";

export type ReduxState = {
    auth: AuthState,
    contacts: ContactsState,
    accounts: AccountState,
    persons: PersonInfoState,
    events: EventsState,
    system: SystemState
}

// export const initialState: ReduxState = {
//     auth: authInitState
// };

export const reducers: any = {
    auth: AuthReducer,
    contacts: ContactsReducer,
    accounts: AccountReducer,
    persons: PersonInfoReducer,
    events: EventsReducer,
    system: SystemReducer
};

const middleware: any = [thunk];

export const store: any = createStore(combineReducers({
    ...reducers
}), compose(applyMiddleware(...middleware)));