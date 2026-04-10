import { ContactType } from "../ContactType";

export interface Contact {
    id: string;
    isAuthorizationContact: boolean;
    show: boolean;
    value: string;
    contactType: ContactType;
    accountId?: string;
    organizationId?: string;
}