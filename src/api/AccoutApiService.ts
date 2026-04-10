import { configure } from "@testing-library/react";
import { BaseRequest } from "./BaseRequest";
import { ChangePasswordRequest } from "./models/Account/Requests/ChangePasswordRequest";
import { CreateAccountRequest } from "./models/Account/Requests/CreateAccountRequest";
import { CommandResult, ICommandResult } from "./models/CommandResult";
import { Account } from "./models/Account/Account";

export class AccountApiService extends BaseRequest{
    createAccount(account: CreateAccountRequest, 
        config?: string): Promise<CommandResult>
    {
        return this.fetchAPI(            
            `/accounts/create`,
            Object.assign({method: "POST", body: JSON.stringify({locationX: account.locationX, 
                locationY: account.locationY,
                login: account.login,
                password: account.password,
                passwordConfirmation: account.passwordConfirmation,
                authorizationContactValue: account.authorizationContactValue,
                authorizationContactType: account.authorizationContactType,
                showContact: account.showContact
            })}, config)
        )
            .catch(BaseRequest.handleError);
    }

    changePassword(changePassword: ChangePasswordRequest,
        config?: string): Promise<CommandResult>{
        return this.fetchAPI('/accounts/changePassword',
            Object.assign({method: "POS", body: JSON.stringify({oldPassword: changePassword.oldPassword, 
                newPasword: changePassword.newPassword, 
                newPasswordConfirmation: changePassword.newPasswordConfirmation})},
            config)
        )
    }

    getCurrentAccountData(config?: string): Promise<ICommandResult<Account>>{
        return this.fetchAPI('/accounts/getData',
            Object.assign({method:"get"}, config)
        ).catch(BaseRequest.handleError);
    }

    getAccountData(accountId: string,
        config?: string): Promise<ICommandResult<Account>>{
        return this.fetchAPI(`/accounts/getData/${accountId}`,
            Object.assign({method:"get"}, config)
        ).catch(BaseRequest.handleError);
    }
}