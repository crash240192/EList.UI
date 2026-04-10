import { ContactsState } from "../types";
import { requestsRepository } from "../../api/RequestsRepository";
import { ContactType } from "../../api/models/Contacts/ContactType";
import { Dispatch } from "redux";

const SET_CONTACT_TYPES = 'SET_CONTACT_TYPES';
let contactsInitState: ContactsState = {
    contactTypes: null
}

export const ContactsReducer = (state = contactsInitState, action: ContactsActionTypes): ContactsState => {
    switch (action.type) {
        case SET_CONTACT_TYPES: {
            return { ...state, contactTypes: action.contactTypes }
        }
        default:
            return state;
    }
}

type ContactsActionTypes = SetContactTypes;

interface SetContactTypes {
    type: typeof SET_CONTACT_TYPES,
    contactTypes: ContactType[]
}

function setContactTypes(contactTypes: ContactType[]) {
    return {
        type: SET_CONTACT_TYPES,
        contactTypes
    }
}

export function loadContactTypes() : any {
    return function (dispatch: Dispatch) {
        requestsRepository.ContactsApiService.getAllContactTypes()
            .then((response) => {
                if (!response.success) {
                    // toastError(response.message);
                    // dispatch(setLoadingArticleGroups(false));
                    dispatch(setContactTypes(null));
                } else {
                    dispatch(setContactTypes(response.result));
                }
            })
    };
}