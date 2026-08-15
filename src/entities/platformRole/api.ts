// entities/platformRole/api.ts

import { apiClient } from '@/shared/api/client';
import type { IAccountPlatformRole, IAssignPlatformRoleRequest, PlatformRoleValue } from './types';
import { PlatformRole } from './types';

type Raw = Record<string, unknown>;

function pickStr(raw: Raw, ...keys: string[]): string {
  for (const key of keys) {
    const v = raw[key];
    if (v != null && v !== '') return String(v);
  }
  return '';
}

function normalizeRole(raw: unknown): PlatformRoleValue {
  const s = String(raw ?? '');
  if (s === PlatformRole.Superuser || s === PlatformRole.Admin || s === PlatformRole.Moderator) {
    return s;
  }
  // на случай camelCase/lower из старых ответов
  const lower = s.toLowerCase();
  if (lower === 'superuser') return PlatformRole.Superuser;
  if (lower === 'admin') return PlatformRole.Admin;
  if (lower === 'moderator') return PlatformRole.Moderator;
  return PlatformRole.Moderator;
}

function normalizeAccountPlatformRole(raw: unknown): IAccountPlatformRole {
  const r = (raw ?? {}) as Raw;
  const assignedBy = r.assignedBy ?? r.AssignedBy;
  return {
    id: pickStr(r, 'id', 'Id'),
    accountId: pickStr(r, 'accountId', 'AccountId'),
    role: normalizeRole(r.role ?? r.Role),
    active: Boolean(r.active ?? r.Active ?? true),
    assignedAt: pickStr(r, 'assignedAt', 'AssignedAt'),
    assignedBy: assignedBy != null && assignedBy !== '' ? String(assignedBy) : null,
  };
}

/** GET /api/platformRoles/my — null, если роли нет */
export async function fetchMyPlatformRole(): Promise<IAccountPlatformRole | null> {
  const data = await apiClient.get<unknown | null>('/api/platformRoles/my');
  if (data.result == null) return null;
  return normalizeAccountPlatformRole(data.result);
}

export async function fetchAllPlatformRoles(
  role?: PlatformRoleValue | null,
  onlyActive = true,
): Promise<IAccountPlatformRole[]> {
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  params.set('onlyActive', onlyActive ? 'true' : 'false');
  const qs = params.toString();
  const data = await apiClient.get<unknown[]>(`/api/platformRoles/all?${qs}`);
  return (data.result ?? []).map(normalizeAccountPlatformRole);
}

export async function fetchPlatformRoleByAccount(
  accountId: string,
): Promise<IAccountPlatformRole | null> {
  const data = await apiClient.get<unknown | null>(
    `/api/platformRoles/byAccount/${accountId}`,
  );
  if (data.result == null) return null;
  return normalizeAccountPlatformRole(data.result);
}

export async function assignPlatformRole(
  payload: IAssignPlatformRoleRequest,
): Promise<string> {
  const data = await apiClient.post<string>('/api/platformRoles/assign', payload);
  return data.result;
}

export async function setPlatformRoleActive(
  accountId: string,
  active: boolean,
): Promise<void> {
  await apiClient.put(
    `/api/platformRoles/setActive/${accountId}?active=${active ? 'true' : 'false'}`,
  );
}

export async function deletePlatformRole(accountId: string): Promise<void> {
  await apiClient.delete(`/api/platformRoles/delete/${accountId}`);
}
