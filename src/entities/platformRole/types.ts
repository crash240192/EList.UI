// entities/platformRole/types.ts — по swagger PlatformRoles

export const PlatformRole = {
  Superuser: 'Superuser',
  Admin: 'Admin',
  Moderator: 'Moderator',
} as const;

export type PlatformRoleValue = (typeof PlatformRole)[keyof typeof PlatformRole];

export const PLATFORM_ROLE_LABELS: Record<PlatformRoleValue, string> = {
  Superuser: 'Суперпользователь',
  Admin: 'Администратор',
  Moderator: 'Модератор',
};

export interface IAccountPlatformRole {
  id: string;
  accountId: string;
  role: PlatformRoleValue;
  active: boolean;
  assignedAt: string;
  assignedBy: string | null;
  account: IPlatformRoleAccount | null;
  assignedByAccount: IPlatformRoleAccount | null;
}

export interface IPlatformRoleAccount {
  id: string;
  login: string;
  avatarId: string | null;
}

export interface IAssignPlatformRoleRequest {
  accountId: string;
  role: PlatformRoleValue;
}
