import { AuthState } from "../types";
import { requestsRepository, resetRequestsRepository } from "../../api/RequestsRepository";
import { Dispatch } from "@reduxjs/toolkit";

const SIGN_IN = 'SIGN_IN';
const SIGN_OUT = 'SIGN_OUT';
const ACTIVATE = "ACTIVATE";

let authInitState: AuthState = {
    token: localStorage.getItem('token') ?? null,
    activationRequired: localStorage.getItem('activationRequired') ? JSON.parse(localStorage.getItem('activationRequired')) : true,
    //activationRequired: JSON.parse(localStorage.getItem('activationRequired')) ?? true,
}

export const AuthReducer = (state = authInitState, action: AuthActionTypes): AuthState => {
    switch (action.type) {
        case SIGN_IN: {
            return { ...state, token: action.token, activationRequired: action.activationRequired }
        }
        case SIGN_OUT: {
            return { ...state, token: null, activationRequired: true }
        }
        case ACTIVATE:{
            return {...state, activationRequired: false};
        }
        default:
            return state;
    }
}

type AuthActionTypes = SignIn | SignOut | Activate;

interface SignIn {
    type: typeof SIGN_IN,
    token: string,
    activationRequired: boolean
}

interface SignOut {
    type: typeof SIGN_OUT
}

interface Activate{
    type: typeof ACTIVATE
}

function setActivation(){
    return { type: ACTIVATE };
}

function dropToken() {
    return { type: SIGN_OUT };
}

function setToken(token: string, activationRequired: boolean) {
    return {
        type: SIGN_IN,
        token,
        activationRequired
    }
}

export function authorize(login: string, password: string): any {
    return function (dispatch: Dispatch) {
        requestsRepository.AuthApiService.signIn(login, password)
            .then((response) => {
                if (response.success) {
                    if (response.result.activationRequired)
                        alert(response.message);                    
                    localStorage.setItem('token', response.result.token);
                    localStorage.setItem('activationRequired', response.result.activationRequired.toString());
                    dispatch(setToken(response.result.token, response.result.activationRequired))
                    debugger;
                    resetRequestsRepository(response.result.token);
                }
                else{
                    alert(response.message);
                }
            });
    }
}

export function activate(code: string): any{
    return function(dispatch: Dispatch){
        requestsRepository.AuthApiService.activate(code)
        .then((response) =>{
            debugger;
            if (response.success)
            {
                dispatch(setActivation())
                localStorage.setItem('activationRequired', 'false');
            }
            else 
                alert(response.message);
        })
    }
}

export function signOut():any{
    return function (dispatch: Dispatch){
        dispatch(dropToken());
        localStorage.removeItem('token');
    }
}