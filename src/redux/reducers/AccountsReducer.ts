import { Dispatch } from "@reduxjs/toolkit";
import { Account } from "../../api/models/Account/Account";
import { CreateAccountRequest } from "../../api/models/Account/Requests/CreateAccountRequest";
import { AccountState } from "../types";
import { requestsRepository } from "../../api/RequestsRepository";

const SET_ACCOUNT = "SET_ACCOUNT";
const SET_ACCOUNTS = "SET_ACCOUNTS";
const SET_CURRENT_ACCOUNT = "SET_CURRENT_ACCOUNT";

let initialState: AccountState = {
    account: null,
    accounts: null,
    currentAccount: null
}

export function AccountReducer(state = initialState, action: AccountAction)
{
    switch(action.type){
        case (SET_CURRENT_ACCOUNT):{
            return {...state, currentAccount: action.currentAccount}            
        }
        case (SET_ACCOUNT):{
            return {...state, account: action.account}            
        }
        case (SET_ACCOUNTS):{
            return {...state, accounts: action.accounts}
        }
        default:{
            return {state}
        }
    }
}

type AccountAction = SetAccount | SetCurrentAccount | SetAccounts;

interface SetAccount{
    type: typeof SET_ACCOUNT,
    account: Account
}

interface SetCurrentAccount{
    type: typeof SET_CURRENT_ACCOUNT,
    currentAccount: Account
}

interface SetAccounts{
    type: typeof SET_ACCOUNTS,
    accounts: Account[]
}

function setCurrentAccountData(currentAccount: Account | null)
{
    return{
        type: SET_CURRENT_ACCOUNT,
        currentAccount
    }
}

function setAccountData(account: Account | null)
{
    return{
        type: SET_ACCOUNT,
        account
    }
}

function setAccountSData(accounts: Account[] | null)
{
    return{
        type: SET_ACCOUNTS,
        accounts
    }
}

export function register(account: CreateAccountRequest):any{
    return function(dispatch: Dispatch){
        requestsRepository.AccountApiService.createAccount(account);
        // .then((response) => {
        //     if (response.success)
        //         dispatch(setAccountData(response.result))
        // })
    }
}

export function loadCurrentAccountData(): any{
    return function(dispatch: Dispatch){
        requestsRepository.AccountApiService.getCurrentAccountData()
        .then((response) => {
            if (response.success)
            {
                dispatch(setCurrentAccountData(response.result));
            }
        })
    }
}

export function loadAccountData(accountId: string): any{
    return function(dispatch: Dispatch){
        debugger;
        requestsRepository.AccountApiService.getAccountData(accountId)
        .then((response) => {
            if (response.success)
            {
                dispatch(setAccountData(response.result));
            }
        })
    }
}