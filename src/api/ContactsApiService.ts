import { BaseRequest } from "./BaseRequest";
import { ICommandResult } from "./models/CommandResult";
import { Contact } from "./models/Contacts/Contact";
import { ContactType } from "./models/Contacts/ContactType";
import { ContactRequest } from "./models/Contacts/Requests/ContactRequest";

export class ContactsApiService extends BaseRequest{
    getAllContactTypes(config?: string) : Promise<ICommandResult<ContactType[]>>
    {
        return this.fetchAPI(`/contacts/contactTypes/getAll`,Object.assign({method: "Get"}, config))
            .catch(BaseRequest.handleError);
    }

    getAccountContacts(accountId: string, config?: string) : Promise<ICommandResult<Contact[]>>{
        return this.fetchAPI(
            `/contacts/getAccountContacts/${accountId}`,
            Object.assign({method:"GET"}, config)
        ).catch(BaseRequest.handleError);
    }

    createContact(contact: ContactRequest,
        config?: string
    ) : Promise<ICommandResult<string>>{
        return this.fetchAPI('/contacts/create',
            Object.assign({method:'POST', body: JSON.stringify({typeId: contact.typeId,
                value: contact.value,
                isAuthorizationContact: contact.isAuthorizationContact,
                show: contact.show})}, config))
                .catch(BaseRequest.handleError);
    }

    updateContact(contact: ContactRequest,
        config?: string
    ) : Promise<ICommandResult<string>>{
        return this.fetchAPI(`/contacts/create/${contact.id}`,
            Object.assign({method:'POST', body: JSON.stringify({typeId: contact.typeId,
                value: contact.value,
                isAuthorizationContact: contact.isAuthorizationContact,
                show: contact.show})}, config))
                .catch(BaseRequest.handleError);
    }
}