import { Dispatch } from "@reduxjs/toolkit";
import { requestsRepository } from "../../api/RequestsRepository";
import { PersonInfo } from "../../api/models/PersonInfo/PersonInfo";
import { PersonInfoState } from "../types";
import { SetPersonInfoRequest } from "../../api/models/PersonInfo/Requests/SetPersonInfoRequest";

const SET_CURRENT_PERSON_INFO = "SET_CURRENT_PERSON_INFO"
const SET_PERSON_INFO = "SET_PERSON_INFO"

let initialState : PersonInfoState = {
    currentPersonInfo: null,
    personInfo: null,
    personInfos: null
}

export default function PersonInfoReducer(state = initialState, action: PersonInfoActionTypes){
    switch(action.type)
    {
        case(SET_CURRENT_PERSON_INFO):{
            return {...state, currentPersonInfo: action.currentPersonInfo}
        }
        case(SET_PERSON_INFO):{
            return {...state, personInfo: action.personInfo}
        }
        default: return state;
    }
}

type PersonInfoActionTypes = SetPersonInfo | SetCurrentPersonInfo;

interface SetPersonInfo{
    type: typeof SET_PERSON_INFO,
    personInfo
}

interface SetCurrentPersonInfo{
    type: typeof SET_CURRENT_PERSON_INFO,
    currentPersonInfo
}

function setCurrentPersonInfo(currentPersonInfo: PersonInfo) {
    return{
        type: SET_CURRENT_PERSON_INFO,
        currentPersonInfo
    }
}

function setPersonInfo(personInfo: PersonInfo) {
    return{
        type: SET_PERSON_INFO,
        personInfo
    }
}

export function loadCurrentPersonInfo(): any {
    return function(dispatch: Dispatch){
        requestsRepository.PersonInfoApiService.getCurrentPersonInfo()
        .then((response) =>{
            if (response.success)
                dispatch(setCurrentPersonInfo(response.result))
        })
    }
}

export function loadPersonInfo(accountId: string): any {
    return function(dispatch: Dispatch){
        requestsRepository.PersonInfoApiService.getPersonInfo(accountId)
        .then((response) =>{            
            if (response.success)
                dispatch(setPersonInfo(response.result))
        })
    }
}


export function updatePersonInfo(accountId: string, personInfo: SetPersonInfoRequest): any{
    return function(dispatch: Dispatch){
        requestsRepository.PersonInfoApiService.setPersonInfo(personInfo)
        .then((response) =>{
            if (response.success)
            {   
                let newPersonInfo: PersonInfo = {
                    firstName: personInfo.firstName,
                    lastName: personInfo.lastName,
                    birthDate: personInfo.birthDate,
                    gender: personInfo.gender,
                    patronymic: personInfo.patronymic,
                    accountId
                }

                dispatch(setCurrentPersonInfo(newPersonInfo));
            }
        });
    }
}