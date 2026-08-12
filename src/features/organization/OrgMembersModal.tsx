// features/organization/OrgMembersModal.tsx

import { useNavigate } from 'react-router-dom';
import {
  formatOrganizationRole,
  organizationMemberAvatarId,
  organizationMemberDisplayName,
  organizationMemberInitials,
  type OrganizationMemberResponse,
} from '@/entities/organization';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { formatPeopleCount } from '@/shared/lib/plural.ru';
import styles from '@/features/event/ParticipantsModal.module.css';

interface OrgMembersModalProps {
  members: OrganizationMemberResponse[];
  onClose: () => void;
}

export function OrgMembersModal({ members, onClose }: OrgMembersModalProps) {
  useModalBackButton(onClose);
  const navigate = useNavigate();

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-label="Команда">
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>Команда</h3>
            {members.length > 0 && (
              <span className={styles.count}>{formatPeopleCount(members.length)}</span>
            )}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className={styles.list}>
          {members.length === 0 ? (
            <div className={styles.empty}>В команде пока никого нет</div>
          ) : (
            members.map(m => (
              <button
                key={m.id}
                type="button"
                className={styles.item}
                onClick={() => {
                  onClose();
                  navigate(`/user/${m.accountId}`);
                }}
              >
                <div className={styles.avaWrap}>
                  <UserAvatar
                    accountId={m.accountId}
                    avatarId={organizationMemberAvatarId(m)}
                    initials={organizationMemberInitials(m)}
                    size={34}
                  />
                </div>
                <div className={styles.info}>
                  <div className={styles.name}>{organizationMemberDisplayName(m)}</div>
                  <div className={styles.login}>{formatOrganizationRole(m.role)}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
