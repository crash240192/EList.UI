import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { IConversation } from '@/entities/conversation';
import { deleteConversation, fetchConversationMessages, updateConversation } from '@/entities/conversation';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { formatDiscussionsCount } from '@/shared/lib/plural.ru';
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
  const [editOnlyVisible, setEditOnlyVisible] = useState(false);
  const [editReadonly, setEditReadonly] = useState(false);
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

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditOnlyVisible(false);
    setEditReadonly(false);
  };

  const handleModalBack = useCallback(() => {
    if (deleteTarget) {
      closeDeleteDialog();
      return;
    }
    if (editingId) {
      cancelEdit();
    } else onClose();
  }, [deleteTarget, editingId, onClose]);

  useModalBackButton(handleModalBack);

  const startEdit = (conversation: IConversation) => {
    setError(null);
    setEditingId(conversation.id);
    setEditName(conversation.name);
    setEditOnlyVisible(Boolean(conversation.participantsOnlyVisible));
    setEditReadonly(Boolean(conversation.participantsReadonly));
  };

  const saveEdit = async (conversationId: string) => {
    const trimmed = editName.trim();
    if (!trimmed || savingId) return;

    const current = conversations.find(c => c.id === conversationId);
    if (
      current
      && current.name === trimmed
      && current.participantsOnlyVisible === editOnlyVisible
      && current.participantsReadonly === editReadonly
    ) {
      cancelEdit();
      return;
    }

    setSavingId(conversationId);
    setError(null);
    try {
      await updateConversation({
        id: conversationId,
        name: trimmed,
        eventId,
        participantsOnlyVisible: editOnlyVisible,
        participantsReadonly: editReadonly,
      });
      cancelEdit();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить обсуждение');
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
      if (editingId === deleteTarget.id) cancelEdit();
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
      hasMessages = (paged.total ?? 0) > 0 || (paged.result?.length ?? 0) > 0;
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
          <div className={styles.headerLeft}>
            <h3 id="discussions-manage-title" className={styles.title}>Обсуждения</h3>
            <span className={styles.count}>{formatDiscussionsCount(conversations.length)}</span>
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
                        <label className={styles.fieldLabel} htmlFor={`discussion-name-${c.id}`}>
                          Название
                        </label>
                        <input
                          id={`discussion-name-${c.id}`}
                          className={styles.renameInput}
                          value={editName}
                          disabled={busy}
                          autoFocus
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void saveEdit(c.id);
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelEdit();
                            }
                          }}
                        />

                        <label className={styles.toggleRow}>
                          <input
                            type="checkbox"
                            checked={editOnlyVisible}
                            disabled={busy}
                            onChange={e => setEditOnlyVisible(e.target.checked)}
                          />
                          <span>
                            <span className={styles.toggleTitle}>Только для участников</span>
                            <span className={styles.toggleHint}>
                              Обсуждение видно только записавшимся на мероприятие
                            </span>
                          </span>
                        </label>

                        <label className={styles.toggleRow}>
                          <input
                            type="checkbox"
                            checked={editReadonly}
                            disabled={busy}
                            onChange={e => setEditReadonly(e.target.checked)}
                          />
                          <span>
                            <span className={styles.toggleTitle}>Участники только читают</span>
                            <span className={styles.toggleHint}>
                              Участники не могут писать комментарии — только организаторы
                            </span>
                          </span>
                        </label>

                        <div className={styles.renameActions}>
                          <button
                            type="button"
                            className={styles.saveBtn}
                            disabled={busy || !editName.trim()}
                            onClick={() => void saveEdit(c.id)}
                          >
                            {savingId === c.id ? 'Сохранение…' : 'Сохранить'}
                          </button>
                          <button
                            type="button"
                            className={styles.cancelBtn}
                            disabled={busy}
                            onClick={cancelEdit}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={styles.name}>{c.name}</div>
                        {(c.participantsOnlyVisible || c.participantsReadonly) && (
                          <div className={styles.flagChips}>
                            {c.participantsOnlyVisible && (
                              <span className={styles.flagChip}>Только участники</span>
                            )}
                            {c.participantsReadonly && (
                              <span className={styles.flagChip}>Только чтение</span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {!isEditing && (
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.renameBtn}
                        disabled={busy || !!editingId}
                        onClick={() => startEdit(c)}
                      >
                        Настроить
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

      {deleteTarget && (
        <ConfirmDialog
          title={deleteStage === 'confirm' ? 'Удалить обсуждение?' : 'В обсуждении есть комментарии'}
          message={
            deleteStage === 'confirm'
              ? `Обсуждение «${deleteTarget.name}» будет удалено.`
              : 'Все комментарии в обсуждении будут удалены безвозвратно. Всё равно удалить?'
          }
          confirmLabel={
            deleteStage === 'confirm'
              ? (checkingMessages ? 'Проверка…' : 'Да')
              : (deletingId ? 'Удаление…' : 'Всё равно удалить')
          }
          cancelLabel={deleteStage === 'confirm' ? 'Нет' : 'Отмена'}
          onConfirm={() => {
            if (deleteStage === 'confirm') void handleConfirmDelete();
            else void performDelete();
          }}
          onCancel={closeDeleteDialog}
        />
      )}
    </>,
    document.body,
  );
}
