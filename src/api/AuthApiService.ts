import { BaseRequest } from "./BaseRequest";
import { AuthData } from "./models/Auth/AuthData";
import { AuthResponse } from "./models/Auth/AuthResponse";
import { CommandResult, ICommandResult } from "./models/CommandResult";

export class AuthApiService extends BaseRequest {
    signIn(
        login: string,
        password: string,
        config?: string
    ): Promise<ICommandResult<AuthResponse>> {
        return this.fetchAPI(
            `/authorization`,
            Object.assign({method: "POST", body: JSON.stringify({login, password})}, config))
            .catch(BaseRequest.handleError);
    }
   
    activate(
        activationCode: string,
        config?: string
    ): Promise<CommandResult> {
        debugger;
        return this.fetchAPI(
            `/authorization/activate?activationKey=${activationCode}`,Object.assign({method: "GET"}, config))
            .catch(BaseRequest.handleError);
    }

    getData(
        config?: string
    ): Promise<ICommandResult<AuthData>> {
        return this.fetchAPI(
            `/authorization/getData`,Object.assign({method: "POST"}, config))
            .catch(BaseRequest.handleError);
    }
}