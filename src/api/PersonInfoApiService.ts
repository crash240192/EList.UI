import { BaseRequest } from "./BaseRequest";
import { ICommandResult } from "./models/CommandResult";
import { PersonInfo } from "./models/PersonInfo/PersonInfo";
import { SetPersonInfoRequest } from "./models/PersonInfo/Requests/SetPersonInfoRequest";

export class PersonInfoApiService extends BaseRequest{
    setPersonInfo(personInfoRequest: SetPersonInfoRequest,
        config?: string) : Promise<ICommandResult<string>>{
        return this.fetchAPI( `/persons/set`,
            Object.assign({method: 'POST', body: JSON.stringify({
                firstName: personInfoRequest.firstName,
                lastName: personInfoRequest.lastName,
                patronymic: personInfoRequest.patronymic,
                gender: personInfoRequest.gender,
                birthDate: personInfoRequest.birthDate
            })}, config)).catch(BaseRequest.handleError)
    }

    getCurrentPersonInfo(config?: string) : Promise<ICommandResult<PersonInfo>>{
        return this.fetchAPI('/persons/get',
            Object.assign({method: 'GET'}, config)
         ).catch(BaseRequest.handleError)
    }

    getPersonInfo(accountId: string,
        config?: string): Promise<ICommandResult<PersonInfo>>{
            return this.fetchAPI(`/persons/get/${accountId}`,
                Object.assign({method: 'GET'}, config)
             ).catch(BaseRequest.handleError)
        }
}