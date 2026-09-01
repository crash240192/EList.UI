// features/organizations/OrgMembersListModal.tsx
// Список команды организации — UX как у SubscribersListModal

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  formatOrganizationRole,
  organizationMemberAvatarId,
  organizationMemberDisplayName,
  type OrganizationMemberResponse,
} from '@/entities/organization';
import { UserChip } from '@/entities/user/ui/UserChip';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import styles from '@/features/subscriptions/SubscribersListModal.module.css';

interface Props {
  members: OrganizationMemberResponse[];
  currentAccountId: string | null;
  onClose: () => void;
}

export function OrgMembersListModal({ members, currentAccountId, onClose }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  useModalBackButton(onClose);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const activeMembers = useMemo(
    () => members.filter(m => m.active !== false),
    [members],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeMembers;
    return activeMembers.filter(m => {
      const name = organizationMemberDisplayName(m).toLowerCase();
      const login = (m.account?.login ?? '').toLowerCase();
      const role = formatOrganizationRole(m.role).toLowerCase();
      return name.includes(q) || login.includes(q) || role.includes(q);
    });
  }, [activeMembers, search]);

  const openMember = useCallback((accountId: string) => {
    navigate(accountId === currentAccountId ? '/user/me' : `/user/${accountId}`);
    onClose();
  }, [currentAccountId, navigate, onClose]);

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-label="Команда">
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>Команда</h3>
            <span className={styles.count}>{activeMembers.length}</span>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        <div className={styles.searchWrap}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.searchIcon}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className={styles.searchInput}
            placeholder="Поиск по имени или логину..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className={styles.searchClear} onClick={() => setSearch('')}>
              ×
            </button>
          )}
        </div>

        <div className={styles.body}>
          {filtered.length === 0 && (
            <p className={styles.state}>{search ? 'Никого не найдено' : 'Список пуст'}</p>
          )}
          {filtered.map(member => {
            const login = member.account?.login?.trim() || organizationMemberDisplayName(member);
            return (
              <div key={member.id} className={styles.row}>
                <button
                  type="button"
                  className={styles.rowMain}
                  onClick={() => openMember(member.accountId)}
                >
                  <UserChip
                    user={{
                      accountId: member.accountId,
                      login,
                      avatarId: organizationMemberAvatarId(member),
                      firstName: member.personInfo?.firstName ?? null,
                      lastName: member.personInfo?.lastName ?? null,
                      isMe: member.accountId === currentAccountId,
                    }}
                    clickable={false}
                    size="md"
                  />
                </button>
                <span className={styles.rowMeta}>{formatOrganizationRole(member.role)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
