export interface SetPersonInfoRequest{
    firstName: string;
    lastName: string;
    patronymic: string | null;
    gender: string | number | null;
    birthDate: Date | null;
}