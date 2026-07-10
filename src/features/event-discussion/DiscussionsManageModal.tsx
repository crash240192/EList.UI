import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { IConversation } from '@/entities/conversation';
import { deleteConversation, fetchConversationMessages, updateConversation } from '@/entities/conversation';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import styles from './DiscussionsManageModal.module.css';

interface DiscussionsManageModalProps {
  eventId: string;
  conversations: IConversation[];
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}

export function DiscussionsManageModal({
  eventId,
  conversations,
  onClose,
  onChanged,
}: DiscussionsManageModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [checkingMessages, setCheckingMessages] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IConversation | null>(null);
  const [deleteStage, setDeleteStage] = useState<'confirm' | 'messages'>('confirm');
  const [error, setError] = useState<string | null>(null);

  const closeDeleteDialog = () => {
    setDeleteTarget(null);
    setDeleteStage('confirm');
  };

  const handleModalBack = useCallback(() => {
    if (deleteTarget) {
      if (deleteStage === 'messages') setDeleteStage('confirm');
      else closeDeleteDialog();
      return;
    }
    if (editingId) {
      setEditingId(null);
      setEditName('');
    } else onClose();
  }, [deleteStage, deleteTarget, editingId, onClose]);

  useModalBackButton(handleModalBack);

  const startRename = (conversation: IConversation) => {
    setError(null);
    setEditingId(conversation.id);
    setEditName(conversation.name);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveRename = async (conversationId: string) => {
    const trimmed = editName.trim();
    if (!trimmed || savingId) return;

    const current = conversations.find(c => c.id === conversationId);
    if (current && current.name === trimmed) {
      cancelRename();
      return;
    }

    setSavingId(conversationId);
    setError(null);
    try {
      await updateConversation({ id: conversationId, name: trimmed, eventId });
      cancelRename();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось переименовать обсуждение');
    } finally {
      setSavingId(null);
    }
  };

  const performDelete = async () => {
    if (!deleteTarget || deletingId) return;
    setDeletingId(deleteTarget.id);
    setError(null);
    try {
      await deleteConversation(deleteTarget.id);
      if (editingId === deleteTarget.id) cancelRename();
      closeDeleteDialog();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить обсуждение');
    } finally {
      setDeletingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || checkingMessages || deletingId) return;

    setCheckingMessages(true);
    let hasMessages = false;
    try {
      const paged = await fetchConversationMessages(deleteTarget.id, 0, 1);
      hasMessages = (paged.total ?? 0) > 0;
    } catch {
      /* если проверку не удалось выполнить — удаляем напрямую */
    } finally {
      setCheckingMessages(false);
    }

    if (hasMessages) {
      setDeleteStage('messages');
    } else {
      await performDelete();
    }
  };

  const requestDelete = (conversation: IConversation) => {
    if (deletingId || checkingMessages || editingId || deleteTarget) return;
    setDeleteTarget(conversation);
    setDeleteStage('confirm');
  };

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={handleModalBack} />
      <div className={styles.modal} role="dialog" aria-modal aria-labelledby="discussions-manage-title">
        <div className={styles.header}>
          <div>
            <h3 id="discussions-manage-title" className={styles.title}>Обсуждения</h3>
            <span className={styles.count}>{conversations.length}</span>
          </div>
          <button type="button" className={styles.closeBtn} onClick={handleModalBack} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {error && <p className={styles.stateError}>{error}</p>}
          {conversations.length === 0 ? (
            <p className={styles.state}>Обсуждений пока нет</p>
          ) : (
            conversations.map(c => {
              const isEditing = editingId === c.id;
              const busy = savingId === c.id || deletingId === c.id;

              return (
                <div key={c.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    {isEditing ? (
                      <div className={styles.renameField}>
                        <input
                          className={styles.renameInput}
                          value={editName}
                          disabled={busy}
                          autoFocus
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void saveRename(c.id);
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelRename();
                            }
                          }}
                        />
                        <div className={styles.renameActions}>
                          <button
                            type="button"
                            className={styles.saveBtn}
                            disabled={busy || !editName.trim()}
                            onClick={() => void saveRename(c.id)}
                          >
                            {savingId === c.id ? 'Сохранение…' : 'Сохранить'}
                          </button>
                          <button
                            type="button"
                            className={styles.cancelBtn}
                            disabled={busy}
                            onClick={cancelRename}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.name}>{c.name}</div>
                    )}
                  </div>

                  {!isEditing && (
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.renameBtn}
                        disabled={busy || !!editingId}
                        onClick={() => startRename(c)}
                      >
                        Переименовать
                      </button>
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        disabled={busy || !!editingId || !!deleteTarget}
                        onClick={() => requestDelete(c)}
                      >
                        {deletingId === c.id ? 'Удаление…' : 'Удалить'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {deleteTarget && deleteStage === 'confirm' && (
        <ConfirmDialog
          title="Удалить обсуждение?"
          message={`Обсуждение «${deleteTarget.name}» будет удалено.`}
          confirmLabel={checkingMessages ? 'Проверка…' : 'Да'}
          cancelLabel="Нет"
          onConfirm={() => void handleConfirmDelete()}
          onCancel={closeDeleteDialog}
        />
      )}

      {deleteTarget && deleteStage === 'messages' && (
        <ConfirmDialog
          title="В обсуждении есть комментарии"
          message="Все комментарии в обсуждении будут удалены безвозвратно. Всё равно удалить?"
          confirmLabel={deletingId ? 'Удаление…' : 'Всё равно удалить'}
          cancelLabel="Отмена"
          onConfirm={() => void performDelete()}
          onCancel={closeDeleteDialog}
        />
      )}
    </>,
    document.body,
  );
}
