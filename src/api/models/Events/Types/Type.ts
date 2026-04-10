import { Category } from "../Categories/Category";

export interface Type{
    id: string;
    name: string;
    namePath: string;
    description: string;
    ico: string;
    eventCategory: Category;
}