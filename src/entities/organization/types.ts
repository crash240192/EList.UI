// entities/organization/types.ts — модели по swagger EList API

/** Роль участника (OrganizationMemberRole) */
export const OrganizationRole = {
  Owner: 'Owner',
  Manager: 'Manager',
} as const;

export type OrganizationRoleValue = (typeof OrganizationRole)[keyof typeof OrganizationRole];

/** Статус верификации (OrganizationVerificationStatus) */
export const OrganizationVerificationStatus = {
  Unverified: 'Unverified',
  Pending: 'Pending',
  Verified: 'Verified',
  Rejected: 'Rejected',
} as const;

export type OrganizationVerificationStatusValue =
  (typeof OrganizationVerificationStatus)[keyof typeof OrganizationVerificationStatus];

/** Правовая форма (OrganizationLegalForm) */
export const OrganizationLegalForm = {
  SelfEmployed: 'SelfEmployed',
  Ip: 'Ip',
  LegalEntity: 'LegalEntity',
} as const;

export type OrganizationLegalFormValue =
  (typeof OrganizationLegalForm)[keyof typeof OrganizationLegalForm];

/** Платёжный провайдер (PaymentProvider) */
export const PaymentProvider = {
  Yookassa: 'Yookassa',
  Tbank: 'Tbank',
  Sberpay: 'Sberpay',
  Payanyway: 'Payanyway',
  Paygine: 'Paygine',
  Other: 'Other',
} as const;

export type PaymentProviderValue = (typeof PaymentProvider)[keyof typeof PaymentProvider];

/** Онбординг выплат (ProviderOnboardingStatus) */
export const OrganizationOnboardingStatus = {
  None: 'None',
  Pending: 'Pending',
  Active: 'Active',
  Rejected: 'Rejected',
} as const;

export type OrganizationOnboardingStatusValue =
  (typeof OrganizationOnboardingStatus)[keyof typeof OrganizationOnboardingStatus];

export interface OrganizationRequest {
  name: string;
  description?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface AddOrganizationMemberRequest {
  accountId: string;
}

export interface TransferOwnershipRequest {
  newOwnerAccountId: string;
}

export interface OrganizationLegalRequest {
  legalForm: OrganizationLegalFormValue;
  inn?: string | null;
  ogrn?: string | null;
  kpp?: string | null;
  legalAddress?: string | null;
  headName?: string | null;
  headBasis?: string | null;
}

/**
 * Запись из реестра (OrganizationRegistryParty).
 * GET /api/organizations/lookup/inn/{inn}
 */
export interface OrganizationRegistryParty {
  inn: string | null;
  ogrn: string | null;
  kpp: string | null;
  name: string | null;
  fullName: string | null;
  legalAddress: string | null;
  headName: string | null;
  headPost: string | null;
  legalForm: OrganizationLegalFormValue | null;
  /** ACTIVE | LIQUIDATING | LIQUIDATED | BANKRUPT | REORGANIZING */
  status: string | null;
  isActive: boolean;
}

export interface OrganizationPayoutRequest {
  bankAccount?: string | null;
  bik?: string | null;
  bankName?: string | null;
  taxRegime?: string | null;
}

export interface OrganizationAccountPublicData {
  id: string;
  active?: boolean;
  login?: string | null;
  avatarId?: string | null;
}

export interface OrganizationPersonInfo {
  id?: string;
  accountId?: string;
  firstName?: string | null;
  lastName?: string | null;
  patronymic?: string | null;
  gender?: string | null;
  birthDate?: string | null;
}

export interface OrganizationMemberResponse {
  id: string;
  accountId: string;
  organizationId: string;
  role: OrganizationRoleValue;
  active: boolean;
  joinedAt?: string | null;
  account?: OrganizationAccountPublicData | null;
  personInfo?: OrganizationPersonInfo | null;
}

export interface OrganizationLegalResponse {
  legalForm: OrganizationLegalFormValue;
  inn?: string | null;
  ogrn?: string | null;
  kpp?: string | null;
  legalAddress?: string | null;
  headName?: string | null;
  headBasis?: string | null;
  verifiedAt?: string | null;
}

export interface OrganizationPayoutResponse {
  bankAccount?: string | null;
  bik?: string | null;
  bankName?: string | null;
  taxRegime?: string | null;
  provider?: PaymentProviderValue | null;
  onboardingStatus?: OrganizationOnboardingStatusValue | null;
}

export interface OrganizationResponse {
  id: string;
  active: boolean;
  name: string;
  description?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  verificationStatus: OrganizationVerificationStatusValue;
  canSellTickets: boolean;
  createDate?: string | null;
  members?: OrganizationMemberResponse[] | null;
  legal?: OrganizationLegalResponse | null;
  payout?: OrganizationPayoutResponse | null;
}
