import { ContactType } from "./ContactType";

export interface Contact{
    id: string,
    isAuthorizationContact: boolean | null,
    value: string,
    contactType: ContactType,
    accountId: string,
    organizationId: string | null
}