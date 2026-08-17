// pages/admin/PlatformRolesTab.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PLATFORM_ROLE_LABELS,
  PlatformRole,
  assignPlatformRole,
  deletePlatformRole,
  fetchAllPlatformRoles,
  fetchPlatformRoleByAccount,
  setPlatformRoleActive,
  type IAccountPlatformRole,
  type PlatformRoleValue,
} from '@/entities/platformRole';
import { fetchAccountById } from '@/entities/user/api';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { Select } from '@/shared/ui/Select/Select';
import { apiIsoToLocalParts } from '@/shared/lib/datetime';
import { usePlatformRoleStore, useToastStore } from '@/app/store';
import { useAccountId } from '@/features/auth/useAccountId';
import styles from './AdminPage.module.css';
import tabStyles from './PlatformRolesTab.module.css';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLE_FILTER_OPTIONS = [
  { value: '', label: 'Все роли' },
  { value: PlatformRole.Superuser, label: PLATFORM_ROLE_LABELS.Superuser },
  { value: PlatformRole.Admin, label: PLATFORM_ROLE_LABELS.Admin },
  { value: PlatformRole.Moderator, label: PLATFORM_ROLE_LABELS.Moderator },
];

function extractAccountId(raw: string): string {
  const trimmed = raw.trim();
  const fromUrl = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return fromUrl ? fromUrl[0] : trimmed;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const { date, time } = apiIsoToLocalParts(iso);
  return `${date} ${time}`;
}

function initialsOf(login: string | null | undefined): string {
  const s = (login ?? '').trim();
  return s ? s.slice(0, 2).toUpperCase() : '?';
}

function roleRank(role: PlatformRoleValue): number {
  if (role === PlatformRole.Superuser) return 0;
  if (role === PlatformRole.Admin) return 1;
  return 2;
}

export function PlatformRolesTab() {
  const toast = useToastStore(s => s.add);
  const { accountId: myAccountId } = useAccountId();
  const myRole = usePlatformRoleStore(s => s.role);
  const refreshMyRole = usePlatformRoleStore(s => s.refresh);
  const isSuperuser = myRole === PlatformRole.Superuser;

  const [items, setItems] = useState<IAccountPlatformRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyActive, setOnlyActive] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [editing, setEditing] = useState<IAccountPlatformRole | null | 'new'>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchAllPlatformRoles(
        (roleFilter || null) as PlatformRoleValue | null,
        onlyActive,
      );
      list.sort((a, b) => {
        const rank = roleRank(a.role) - roleRank(b.role);
        if (rank !== 0) return rank;
        const al = a.account?.login ?? a.accountId;
        const bl = b.account?.login ?? b.accountId;
        return al.localeCompare(bl, 'ru');
      });
      setItems(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [onlyActive, roleFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const editingId = editing && editing !== 'new' ? editing.id : null;
  const assignableRoles = useMemo(() => {
    const roles: PlatformRoleValue[] = [PlatformRole.Moderator, PlatformRole.Admin];
    if (isSuperuser) roles.unshift(PlatformRole.Superuser);
    return roles.map(value => ({ value, label: PLATFORM_ROLE_LABELS[value] }));
  }, [isSuperuser]);

  const canManage = (item: IAccountPlatformRole) => {
    if (item.role === PlatformRole.Superuser) return isSuperuser;
    return true;
  };

  if (loading) return <div className={styles.loader}>Загрузка...</div>;
  if (error) return <div className={styles.errorMsg}>{error}</div>;

  return (
    <div className={styles.splitPane}>
      <div className={`${styles.listPane} ${editing !== null ? styles.mobileHidden : ''}`}>
        <div className={styles.paneHeader}>
          <h2 className={styles.paneTitle}>Роли площадки</h2>
          <button type="button" className={styles.addBtn} onClick={() => setEditing('new')}>
            + Назначить
          </button>
        </div>
        <div className={styles.paneHeader} style={{ paddingTop: 0 }}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={e => setOnlyActive(e.target.checked)}
            />
            Только активные
          </label>
          <div style={{ minWidth: 160 }}>
            <Select value={roleFilter} onChange={setRoleFilter} options={ROLE_FILTER_OPTIONS} />
          </div>
        </div>
        <div className={styles.itemList}>
          {items.length === 0 && (
            <div className={styles.groupEmpty}>Ролей площадки пока нет</div>
          )}
          {items.map(item => {
            const login = item.account?.login;
            return (
              <div
                key={item.id || item.accountId}
                className={`${styles.categoryRow} ${tabStyles.row} ${editingId === item.id ? styles.listRowActive : ''}`}
                onClick={() => setEditing(item)}
              >
                <UserAvatar
                  accountId={item.accountId}
                  avatarId={item.account?.avatarId ?? null}
                  initials={initialsOf(login)}
                  size={32}
                  className={tabStyles.avatar}
                />
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>
                    {login ? `@${login}` : item.accountId.slice(0, 8)}
                    {item.accountId === myAccountId && (
                      <span className={tabStyles.you}>вы</span>
                    )}
                  </span>
                  <span className={styles.itemSub}>
                    {PLATFORM_ROLE_LABELS[item.role]}
                    {item.assignedAt ? ` · ${formatDateTime(item.assignedAt)}` : ''}
                  </span>
                </div>
                <div className={styles.itemMeta}>
                  <span className={styles.tag}>{item.active ? 'активна' : 'выкл.'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`${styles.formPane} ${editing === null ? styles.mobileHidden : ''}`}>
        <button type="button" className={styles.mobileBackBtn} onClick={() => setEditing(null)}>
          ← Назад к списку
        </button>
        {editing !== null ? (
          <RoleForm
            key={editing === 'new' ? 'new-role' : (editing as IAccountPlatformRole).id}
            item={editing === 'new' ? null : editing}
            myAccountId={myAccountId}
            isSuperuser={isSuperuser}
            canManage={editing === 'new' || canManage(editing)}
            assignableRoles={assignableRoles}
            onSaved={async (changedSelf) => {
              setEditing(null);
              await load();
              if (changedSelf) await refreshMyRole();
            }}
            onCancel={() => setEditing(null)}
            toast={toast}
          />
        ) : (
          <div className={styles.emptyForm}>
            <p>Выберите запись или назначьте роль</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RoleForm({
  item,
  myAccountId,
  isSuperuser,
  canManage,
  assignableRoles,
  onSaved,
  onCancel,
  toast,
}: {
  item: IAccountPlatformRole | null;
  myAccountId: string | null;
  isSuperuser: boolean;
  canManage: boolean;
  assignableRoles: { value: string; label: string }[];
  onSaved: (changedSelf: boolean) => Promise<void>;
  onCancel: () => void;
  toast: (message: string, type?: 'error' | 'success' | 'info') => void;
}) {
  const [accountId, setAccountId] = useState(item?.accountId ?? '');
  const [login, setLogin] = useState(item?.account?.login ?? '');
  const [avatarId, setAvatarId] = useState<string | null>(item?.account?.avatarId ?? null);
  const [existing, setExisting] = useState<IAccountPlatformRole | null>(item);
  const [role, setRole] = useState<string>(
    item?.role && assignableRoles.some(o => o.value === item.role)
      ? item.role
      : assignableRoles[0]?.value ?? PlatformRole.Moderator,
  );
  const [active, setActive] = useState(item?.active ?? true);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const resolvedId = extractAccountId(accountId);
  const isSelf = Boolean(myAccountId && resolvedId === myAccountId);

  const lookup = async () => {
    const id = extractAccountId(accountId);
    if (!UUID_RE.test(id)) {
      setErr('Укажите UUID аккаунта (можно вставить ссылку на профиль)');
      return;
    }
    setLooking(true);
    setErr(null);
    try {
      const [acc, current] = await Promise.all([
        fetchAccountById(id),
        fetchPlatformRoleByAccount(id).catch(() => null),
      ]);
      setAccountId(acc.id || id);
      setLogin(acc.login ?? '');
      setAvatarId(acc.avatarId ?? null);
      setExisting(current);
      if (current) {
        setRole(
          assignableRoles.some(o => o.value === current.role)
            ? current.role
            : assignableRoles[0]?.value ?? current.role,
        );
        setActive(current.active);
      }
    } catch (e) {
      setLogin('');
      setAvatarId(null);
      setExisting(null);
      setErr(e instanceof Error ? e.message : 'Аккаунт не найден');
    } finally {
      setLooking(false);
    }
  };

  const handleSave = async () => {
    const id = extractAccountId(accountId);
    if (!UUID_RE.test(id)) {
      setErr('Укажите UUID аккаунта');
      return;
    }
    if (!role) {
      setErr('Выберите роль');
      return;
    }
    if (role === PlatformRole.Superuser && !isSuperuser) {
      setErr('Назначить суперпользователя может только суперпользователь');
      return;
    }
    if (!canManage) {
      setErr('Недостаточно прав для этой записи');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await assignPlatformRole({ accountId: id, role: role as PlatformRoleValue });
      if (existing && existing.active !== active) {
        await setPlatformRoleActive(id, active);
      } else if (!existing && !active) {
        await setPlatformRoleActive(id, false);
      }
      toast('Роль сохранена', 'success');
      await onSaved(isSelf);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const id = extractAccountId(accountId);
    if (!existing || !canManage) return;
    if (!window.confirm('Снять роль площадки с этого аккаунта?')) return;
    setSaving(true);
    setErr(null);
    try {
      await deletePlatformRole(id);
      toast('Роль снята', 'success');
      await onSaved(isSelf);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось снять роль');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.form}>
      <h3 className={styles.formTitle}>{item ? 'Роль аккаунта' : 'Назначить роль'}</h3>
      {err && <div className={styles.formError}>{err}</div>}
      {!canManage && (
        <div className={styles.formError}>
          Менять суперпользователя может только суперпользователь
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label}>Аккаунт *</label>
        <div className={tabStyles.lookup}>
          <input
            className={styles.input}
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            placeholder="UUID или ссылка /user/…"
            disabled={Boolean(item) || saving}
          />
          {!item && (
            <button
              type="button"
              className={tabStyles.lookupBtn}
              onClick={() => void lookup()}
              disabled={looking || saving}
            >
              {looking ? '…' : 'Найти'}
            </button>
          )}
        </div>
        <span className={styles.fieldHint}>
          Глобального поиска аккаунтов нет — вставьте id из профиля пользователя.
        </span>
      </div>

      {(login || existing) && (
        <div className={tabStyles.preview}>
          <UserAvatar
            accountId={resolvedId}
            avatarId={avatarId}
            initials={initialsOf(login)}
            size={36}
          />
          <div>
            <div className={tabStyles.previewName}>
              {login ? `@${login}` : resolvedId.slice(0, 8)}
              {isSelf && <span className={tabStyles.you}>вы</span>}
            </div>
            <div className={tabStyles.previewMeta}>
              {existing
                ? `${PLATFORM_ROLE_LABELS[existing.role]} · ${existing.active ? 'активна' : 'выкл.'}`
                : 'Нет роли площадки'}
            </div>
          </div>
        </div>
      )}

      <div className={styles.field}>
        <span className={styles.label}>Роль</span>
        <Select
          value={role}
          onChange={setRole}
          options={assignableRoles}
          disabled={!canManage || saving}
        />
      </div>

      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={active}
          disabled={!canManage || saving}
          onChange={e => setActive(e.target.checked)}
        />
        Активна
      </label>

      {item?.assignedByAccount?.login && (
        <p className={styles.fieldHint}>
          Назначил @{item.assignedByAccount.login} · {formatDateTime(item.assignedAt)}
        </p>
      )}

      <div className={styles.formActions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={saving}>
          Отмена
        </button>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={() => void handleSave()}
          disabled={saving || !canManage}
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>

      {existing && canManage && (
        <div className={tabStyles.dangerAction}>
          <button
            type="button"
            className={tabStyles.deleteBtn}
            disabled={saving}
            onClick={() => void handleDelete()}
          >
            Снять роль площадки
          </button>
        </div>
      )}
    </div>
  );
}
