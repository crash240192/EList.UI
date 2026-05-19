import { useState, useEffect, useCallback } from 'react';
import type { IConversation } from '@/entities/conversation';
import {
  createConversation,
  deleteConversation,
  fetchEventConversations,
} from '@/entities/conversation';
import styles from './EventDiscussionsAdmin.module.css';

interface EventDiscussionsAdminProps {
  eventId: string;
}

export function EventDiscussionsAdmin({ eventId }: EventDiscussionsAdminProps) {
  const [conversations, setConversations] = useState<IConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetchEventConversations(eventId)
      .then(setConversations)
      .catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить обсуждения'))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setError(null);
    try {
      await createConversation({ name: trimmed, eventId });
      setName('');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать обсуждение');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (conversationId: string) => {
    if (deletingId) return;
    if (!window.confirm('Удалить это обсуждение и все комментарии?')) return;
    setDeletingId(conversationId);
    setError(null);
    try {
      await deleteConversation(conversationId);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить обсуждение');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={styles.admin}>
      <p className={styles.hint}>
        Создайте темы обсуждения — участники увидят их на странице мероприятия во вкладках.
      </p>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <p className={styles.hint}>Загрузка…</p>
      ) : conversations.length > 0 ? (
        <ul className={styles.list}>
          {conversations.map((c) => (
            <li key={c.id} className={styles.item}>
              <span className={styles.itemName}>{c.name}</span>
              <button
                type="button"
                className={styles.deleteBtn}
                disabled={deletingId === c.id}
                onClick={() => void handleDelete(c.id)}
              >
                {deletingId === c.id ? 'Удаление…' : 'Удалить'}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.hint}>Обсуждений пока нет</p>
      )}

      <div className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="discussion-name">
            Название обсуждения
          </label>
          <input
            id="discussion-name"
            className={styles.input}
            value={name}
            disabled={creating}
            placeholder="Например: Вопросы по участию"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleCreate();
              }
            }}
          />
        </div>
        <button
          type="button"
          className={styles.createBtn}
          disabled={creating || !name.trim()}
          onClick={() => void handleCreate()}
        >
          {creating ? 'Создание…' : 'Добавить'}
        </button>
      </div>
    </div>
  );
}
