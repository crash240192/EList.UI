export interface Account {
    id: string;
    active: boolean;
    locationX: number;
    locationy: number;
    login: string;
    registrationDate: Date;
    lastSeenDate: Date;
    lastActionDate: Date;
}