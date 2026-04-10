import { env } from "../env";
import generateGUID from "../support/generateGuid";

export class BaseRequest {
    private jwt: string;
    private token:string;
    static headers = new Headers();
    private baseUrl = env.BACKEND_URL;

    constructor(token?: string ) {
        BaseRequest.headers.set("accept", "application/json");
        BaseRequest.headers.set("Content-Type", "application/json");

        token ??=localStorage.getItem('token');
        this.token = token;

        if (this.token) {
            BaseRequest.headers.set(
                "Authorization",
                `${this.token}`
            );
        }

        if (!this.jwt) {
            if (!localStorage.getItem('jwt')) {
                localStorage.setItem('jwt', generateGUID());
            }
            this.jwt = localStorage.getItem('jwt');
        }

        BaseRequest.headers.set(
            "Authorization-jwt",
            `${this.jwt}`
        );
    }

    static handleError = (error: any): Promise<any> => {
        return Promise.reject(error.message || error);
    };

    async fetchAPI(url: string, config: Record<string, any>): Promise<any> {
        const header = BaseRequest.headers;
        const response = await fetch(this.baseUrl + url, {
            headers: header,
            ...config,
        });
        
        if (!response.ok)
        {
            //alert(`${response.status} ${response.statusText}`);
            return {
                success: false,
                message: response.statusText
            };
        }

        const res = await response.json();        
        return res;
    }
}
