export interface ICommandResult<T> {
    result?: T;
    success: boolean;
    errorCode?: number;
    message?: string;
    stackTrace?: string;
}
export interface CommandResult {
    success: boolean;
    errorCode?: number;
    message?: string;
    stackTrace?: string;
}