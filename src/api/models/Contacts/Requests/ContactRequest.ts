export interface ContactRequest {
    id: string | null;
    typeId: string;
    value: string;
    isAuthorizationContact: boolean | null;
    show: boolean;
}