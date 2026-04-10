export interface AuthData{
    token: string,
    active: boolean,
    accountId: string,
    clientHash: string,
    activationAttemptsRemaining: number,
    activationKey: string,
    creationDate: Date,
    authorizationDate: Date
}