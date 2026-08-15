// app/store/platformRoleStore.ts — роль площадки текущего пользователя

import { create } from 'zustand';
import {
  fetchMyPlatformRole,
  PlatformRole,
  type IAccountPlatformRole,
  type PlatformRoleValue,
} from '@/entities/platformRole';

interface PlatformRoleState {
  role: PlatformRoleValue | null;
  active: boolean;
  accountRole: IAccountPlatformRole | null;
  loaded: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  clear: () => void;
  /** Есть активная роль площадки → доступ в /admin и модерацию */
  hasPlatformAccess: () => boolean;
  isModeratorOrAbove: () => boolean;
  isAdminOrAbove: () => boolean;
  isSuperuser: () => boolean;
}

const STAFF: PlatformRoleValue[] = [
  PlatformRole.Moderator,
  PlatformRole.Admin,
  PlatformRole.Superuser,
];

const ADMIN_PLUS: PlatformRoleValue[] = [
  PlatformRole.Admin,
  PlatformRole.Superuser,
];

export const usePlatformRoleStore = create<PlatformRoleState>()((set, get) => ({
  role: null,
  active: false,
  accountRole: null,
  loaded: false,
  loading: false,

  refresh: async () => {
    set({ loading: true });
    try {
      const accountRole = await fetchMyPlatformRole();
      const active = Boolean(accountRole?.active);
      const role = active && accountRole ? accountRole.role : null;
      set({
        accountRole,
        role,
        active: Boolean(role),
        loaded: true,
        loading: false,
      });
    } catch {
      set({
        accountRole: null,
        role: null,
        active: false,
        loaded: true,
        loading: false,
      });
    }
  },

  clear: () =>
    set({
      role: null,
      active: false,
      accountRole: null,
      loaded: false,
      loading: false,
    }),

  hasPlatformAccess: () => {
    const { role, active } = get();
    return active && role != null && STAFF.includes(role);
  },

  isModeratorOrAbove: () => get().hasPlatformAccess(),

  isAdminOrAbove: () => {
    const { role, active } = get();
    return active && role != null && ADMIN_PLUS.includes(role);
  },

  isSuperuser: () => {
    const { role, active } = get();
    return active && role === PlatformRole.Superuser;
  },
}));
