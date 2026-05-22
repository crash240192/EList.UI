/** Коды ошибок API (CommandResult.errorCode). Список дополняется по мере появления на бэкенде. */

export const ApiErrorCode = {
  OK: 0,
  InternalError: 1,
  IsNullOrEmpty: 2,
  FormatError: 3,
  FileNotSpecified: 4,
  InvalidValue: 5,
  AccessError: 6,

  AuthorizationDataNotFound: 1001,
  AuthorizationDataInactive: 1002,
  AuthenticationError: 1003,
  InvalidActivationKey: 1004,
  ActivationAttemptsExceed: 1005,
  PasswordsDontMatch: 1006,
  NewAndOldPasswordsMatch: 1007,

  DublicateAccount: 2001,
  AccountNotFound: 2002,

  UserHasNoNecessaryContacts: 3001,
  UnableToNotifyUser: 3002,

  PersonNotExists: 4000,
  InvalidFirstName: 4001,
  InvalidLastName: 4002,

  SubscriptionAlreadyExists: 5000,
  SubscriptionNotExists: 5001,

  EventTypeNotFound: 6000,
  EventCategoryNotFound: 6001,
  EventNotFound: 6002,
  EventParametersNotFound: 6003,

  InvitationNotFound: 7000,
  InvitationForbidden: 7001,

  ContactNotFound: 8000,

  AccountAvatarsHistoryIsEmpty: 9000,
  OrganizationAvatarsHistoryIsEmpty: 9001,

  TariffNotFound: 10001,
  TariffValidatorNotFound: 10002,
  WalletNotFound: 10003,
  TariffNotAssigned: 10004,
  PaymentValueMustBeOverZero: 10005,
  AccountWalletAlreadyExists: 10006,

  OrganizationNotFound: 11001,

  EventIsFull: 12001,

  EventCancelled: 13001,
  EventNotExists: 13002,
  EventAccessDenied: 13003,

  MessageNotFound: 14001,

  RatingItemNotFound: 15001,
} as const;

export type ApiErrorCodeValue = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

/** Общая ошибка доступа или запрет просмотра конкретного мероприятия */
export function isAccessDeniedApiCode(code: number): boolean {
  return code === ApiErrorCode.AccessError || code === ApiErrorCode.EventAccessDenied;
}

export function isEventAccessDeniedCode(code: number): boolean {
  return code === ApiErrorCode.EventAccessDenied;
}
