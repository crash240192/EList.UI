export interface PagedList<T>{
    pageIndex: number,
    pageSize: number,
    result: T,
    total: number;
}