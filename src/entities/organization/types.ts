// entities/organization/types.ts — модели API организаций

/** Роль участника организации */
export const OrganizationRole = {
  Owner: 'owner',
  Manager: 'manager',
} as const;

export type OrganizationRoleValue = (typeof OrganizationRole)[keyof typeof OrganizationRole];

/** Статус верификации для продажи билетов */
export const OrganizationVerificationStatus = {
  Unverified: 'unverified',
  Pending: 'pending',
  Verified: 'verified',
  Rejected: 'rejected',
} as const;

export type OrganizationVerificationStatusValue =
  (typeof OrganizationVerificationStatus)[keyof typeof OrganizationVerificationStatus];

/** Правовая форма (продажа билетов) */
export const OrganizationLegalForm = {
  SelfEmployed: 'self_employed',
  IndividualEntrepreneur: 'individual_entrepreneur',
  LegalEntity: 'legal_entity',
} as const;

export type OrganizationLegalFormValue =
  (typeof OrganizationLegalForm)[keyof typeof OrganizationLegalForm];

/** Статус онбординга выплат у провайдера */
export const OrganizationOnboardingStatus = {
  None: 'none',
  Pending: 'pending',
  Active: 'active',
  Rejected: 'rejected',
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
  inn: string;
  ogrn?: string | null;
  kpp?: string | null;
  legalAddress: string;
  headName: string;
  headBasis?: string | null;
}

export interface OrganizationPayoutRequest {
  bankAccount: string;
  bik: string;
  bankName: string;
  taxRegime?: string | null;
}

export interface OrganizationMemberResponse {
  accountId: string;
  role: OrganizationRoleValue;
  active: boolean;
  login?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarId?: string | null;
  joinedAt?: string | null;
}

export interface OrganizationLegalResponse {
  legalForm: OrganizationLegalFormValue;
  inn: string;
  ogrn?: string | null;
  kpp?: string | null;
  legalAddress: string;
  headName: string;
  headBasis?: string | null;
}

export interface OrganizationPayoutResponse {
  bankAccount: string;
  bik: string;
  bankName: string;
  taxRegime?: string | null;
  provider?: string | null;
  providerSellerId?: string | null;
  onboardingStatus?: OrganizationOnboardingStatusValue | null;
}

export interface OrganizationResponse {
  id: string;
  name: string;
  description?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  active: boolean;
  verificationStatus: OrganizationVerificationStatusValue;
  canSellTickets: boolean;
  avatarId?: string | null;
  creationDate?: string | null;
  /** Роль текущего пользователя, если участник */
  myRole?: OrganizationRoleValue | null;
  rejectReason?: string | null;
  members?: OrganizationMemberResponse[] | null;
  legal?: OrganizationLegalResponse | null;
  payout?: OrganizationPayoutResponse | null;
}
