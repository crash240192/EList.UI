// features/subscriptions/SubscribersListModal.tsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ISubscriptionItem } from '@/entities/user/subscriptionApi';
import { UserChip } from '@/entities/user/ui/UserChip';
import styles from './SubscribersListModal.module.css';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';

interface Props {
  title: string;
  fetchFn: () => Promise<ISubscriptionItem[]>;
  currentAccountId: string | null;
  onClose: () => void;
}

export function SubscribersListModal({ title, fetchFn, currentAccountId, onClose }: Props) {
  useModalBackButton(onClose);
  const navigate = useNavigate();
  const [items,   setItems]   = useState<ISubscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetchFn()
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(e => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
    // закрытие по Escape
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [fetchFn, onClose]);

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          {loading && <p className={styles.state}>Загрузка...</p>}
          {error   && <p className={styles.stateError}>{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p className={styles.state}>Список пуст</p>
          )}
          {items.map(item => (
            <div
              key={item.account.id}
              className={styles.row}
              onClick={() => { onClose(); navigate(`/user/${item.account.id}`); }}
            >
              <UserChip
                user={{
                  accountId: item.account.id,
                  login:     item.account.login,
                  firstName: item.personInfo?.firstName ?? null,
                  lastName:  item.personInfo?.lastName  ?? null,
                  isMe:      item.account.id === currentAccountId,
                }}
                clickable={false}
                size="md"
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
