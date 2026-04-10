export interface CreateAccountRequest {
    locationX: number;
    locationY: number;
    login: string;
    password: string;
    passwordConfirmation: string;
    authorizationContactValue: string;
    authorizationContactType: string;
    showContact: boolean
}