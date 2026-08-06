// entities/organization/labels.ts

import {
  OrganizationLegalForm,
  OrganizationOnboardingStatus,
  OrganizationRole,
  OrganizationVerificationStatus,
  type OrganizationLegalFormValue,
  type OrganizationMemberResponse,
  type OrganizationOnboardingStatusValue,
  type OrganizationRoleValue,
  type OrganizationVerificationStatusValue,
} from './types';

export function formatOrganizationRole(role: OrganizationRoleValue): string {
  switch (role) {
    case OrganizationRole.Owner: return 'Владелец';
    case OrganizationRole.Manager: return 'Администратор';
    default: return role;
  }
}

export function formatVerificationStatus(status: OrganizationVerificationStatusValue): string {
  switch (status) {
    case OrganizationVerificationStatus.Unverified: return 'Не верифицирована';
    case OrganizationVerificationStatus.Pending: return 'На проверке';
    case OrganizationVerificationStatus.Verified: return 'Верифицирована';
    case OrganizationVerificationStatus.Rejected: return 'Отклонена';
    default: return status;
  }
}

export function formatLegalForm(form: OrganizationLegalFormValue): string {
  switch (form) {
    case OrganizationLegalForm.SelfEmployed: return 'Самозанятый';
    case OrganizationLegalForm.Ip: return 'ИП';
    case OrganizationLegalForm.LegalEntity: return 'Юридическое лицо';
    default: return form;
  }
}

/** Статус организации в реестре (OrganizationRegistryParty.Status) */
export function formatRegistryStatus(status: string | null | undefined): string {
  switch (String(status ?? '').toUpperCase()) {
    case 'ACTIVE': return 'Действует';
    case 'LIQUIDATING': return 'В процессе ликвидации';
    case 'LIQUIDATED': return 'Ликвидирована';
    case 'BANKRUPT': return 'Банкротство';
    case 'REORGANIZING': return 'Реорганизация';
    default: return status?.trim() || 'Неизвестно';
  }
}

export function formatOnboardingStatus(status: OrganizationOnboardingStatusValue | null | undefined): string {
  switch (status) {
    case OrganizationOnboardingStatus.None: return 'Не начат';
    case OrganizationOnboardingStatus.Pending: return 'В процессе';
    case OrganizationOnboardingStatus.Active: return 'Активен';
    case OrganizationOnboardingStatus.Rejected: return 'Отклонён';
    default: return 'Не начат';
  }
}

export function organizationMemberDisplayName(m: OrganizationMemberResponse): string {
  const full = [m.personInfo?.firstName, m.personInfo?.lastName].filter(Boolean).join(' ').trim();
  if (full) return full;
  const login = m.account?.login;
  if (login) return `@${login}`;
  return m.accountId.slice(0, 8);
}

export function organizationMemberInitials(m: OrganizationMemberResponse): string {
  const first = m.personInfo?.firstName?.[0];
  const last = m.personInfo?.lastName?.[0];
  if (first) return `${first}${last ?? ''}`.toUpperCase();
  return (m.account?.login?.[0] ?? '?').toUpperCase();
}

/** avatarId из вложенного account; undefined = неизвестно (пусть useAvatar сделает fetch) */
export function organizationMemberAvatarId(
  m: OrganizationMemberResponse,
): string | null | undefined {
  if (!m.account) return undefined;
  const id = m.account.avatarId;
  if (id == null || id === '') return undefined;
  return id;
}
