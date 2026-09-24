import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { IMessage, IMessagePathNode, MessageVoteValue } from '@/entities/conversation';
import {
  updateMessage,
  deleteMessage,
  fetchMessageReplies,
  likeMessage,
  dislikeMessage,
} from '@/entities/conversation';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { clampText, textLengthError } from '@/shared/lib/clampText';
import { TextLengthHint } from '@/shared/ui/TextLengthHint/TextLengthHint';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { ImageLightbox } from '@/shared/ui/ImageLightbox';
import { ContentReportModal } from '@/features/content-reports';
import { ReportTargetType } from '@/entities/contentReport';
import {
  messageAuthorName,
  messageInitials,
  formatMessageDate,
  formatReplyCount,
  discussionMessageDomId,
  isLongMessageText,
  canDeleteMessage,
  messageHasReplies,
  scrollDiscussionMessageIntoView,
} from './messageUtils';
import { DISCUSSION_MESSAGE_MAX_FILES, DISCUSSION_MESSAGE_MAX_LENGTH } from './discussionUiConstants';
import { MessageReplies } from './MessageReplies';
import type { DiscussionViewMode } from './discussionViewMode';
import { useDiscussionRefresh } from './discussionRefreshContext';
import { uploadFile } from '@/shared/api/fileStorageClient';
import { filterImageFiles } from '@/shared/lib/imageFile';
import styles from './MessageRow.module.css';

interface MessageRowProps {
  message: IMessage;
  depth: number;
  highlighted?: boolean;
  /** Подсветка deep-link (уведомление) */
  focusTarget?: boolean;
  activeReplyId?: string | null;
  conversationId: string;
  currentAccountId: string | null;
  viewMode?: DiscussionViewMode;
  /** Корень ветки; для корневых комментариев = message.id */
  threadRootId?: string;
  /** Подпись «в ответ …» в режиме ленты */
  replyToAuthor?: string | null;
  /**
   * Дерево: родитель имеет ровно одного ребёнка с продолжением —
   * раскрываем цепочку сразу (до развилки).
   */
  autoExpandChain?: boolean;
  /** Оставшийся путь focus ниже этого узла (дети → … → цель) */
  focusPathTail?: IMessagePathNode[];
  focusTargetId?: string | null;
  onFocusHandled?: () => void;
  onReply?: (message: IMessage, threadRootId: string) => void;
  onDeleted?: (messageId: string) => void;
}

function ReplyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function LikeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function DislikeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
      <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function MessageRow({
  message,
  depth,
  highlighted = false,
  focusTarget = false,
  activeReplyId = null,
  conversationId,
  currentAccountId,
  viewMode = 'tree',
  threadRootId,
  replyToAuthor = null,
  autoExpandChain = false,
  focusPathTail,
  focusTargetId = null,
  onFocusHandled,
  onReply,
  onDeleted,
}: MessageRowProps) {
  const navigate = useNavigate();
  /**
   * Корень ветки: сразу превью прямых ответов.
   * Автоцепочка: единственный ребёнок с продолжением — раскрыт.
   * Deep-link: раскрываем предков цели.
   * Иначе вложенное свёрнуто до клика.
   */
  const [expanded, setExpanded] = useState(() => {
    if (focusPathTail && focusPathTail.length > 0) return true;
    if (!message.replied) return false;
    if (autoExpandChain) return true;
    return depth === 0;
  });
  const [textExpanded, setTextExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.messageText);
  const [displayText, setDisplayText] = useState(message.messageText);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [replyTotal, setReplyTotal] = useState<number | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [alreadyReported, setAlreadyReported] = useState(false);
  const [likesCount, setLikesCount] = useState(() => message.likesCount ?? 0);
  const [dislikesCount, setDislikesCount] = useState(() => message.dislikesCount ?? 0);
  const [userVote, setUserVote] = useState<MessageVoteValue | null>(
    () => message.currentUserVote ?? null,
  );
  const [voting, setVoting] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [editFileIds, setEditFileIds] = useState<string[]>(() => message.fileIds ?? []);
  const [editUploads, setEditUploads] = useState<Array<{
    localId: string;
    previewUrl: string;
    error?: string;
  }>>([]);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const editUploadsRef = useRef(editUploads);
  editUploadsRef.current = editUploads;

  const replyBump = useDiscussionRefresh(message.id);
  const fileIds = message.fileIds ?? [];
  const [displayFileIds, setDisplayFileIds] = useState(fileIds);
  const uploadingEdit = editUploads.some(u => !u.error);
  const editSlotCount = editFileIds.length + editUploads.length;
  const prevReplyBump = useRef(replyBump);
  const isMine = !!currentAccountId && message.accountId === currentAccountId;
  const isHidden = Boolean(message.hidden);
  const canReport = !!currentAccountId && !isMine && !isHidden;
  const hasReplies = messageHasReplies(message, replyBump, replyTotal);
  const canDelete = isMine && !isHidden && canDeleteMessage(message, replyBump, replyTotal);
  const accountId = message.accountId ?? message.account?.id ?? '';
  const initials = messageInitials(message);
  const rootId = threadRootId ?? message.id;
  /** В ленте вложенные ответы уже собраны под корнем — не открываем новое дерево */
  const canNestReplies = viewMode === 'tree' || message.id === rootId;

  useEffect(() => {
    if (focusPathTail && focusPathTail.length > 0) setExpanded(true);
  }, [focusPathTail]);

  useEffect(() => {
    if (!focusTarget) return;
    const delays = [60, 200, 480, 900].map((ms) =>
      window.setTimeout(() => {
        if (scrollDiscussionMessageIntoView(message.id)) {
          onFocusHandled?.();
        }
      }, ms),
    );
    return () => delays.forEach((id) => window.clearTimeout(id));
  }, [focusTarget, message.id, onFocusHandled]);

  useEffect(() => {
    setLikesCount(message.likesCount ?? 0);
    setDislikesCount(message.dislikesCount ?? 0);
    setUserVote(message.currentUserVote ?? null);
  }, [message.id, message.likesCount, message.dislikesCount, message.currentUserVote]);

  useEffect(() => {
    setDisplayText(message.messageText);
    setEditText(clampText(message.messageText, DISCUSSION_MESSAGE_MAX_LENGTH));
    setDisplayFileIds(message.fileIds ?? []);
    setEditFileIds(message.fileIds ?? []);
    setEditUploads(prev => {
      prev.forEach(u => URL.revokeObjectURL(u.previewUrl));
      return [];
    });
    setTextExpanded(false);
    setEditError(null);
  }, [message.id, message.messageText, message.fileIds?.join(',')]);

  useEffect(() => () => {
    editUploadsRef.current.forEach(u => URL.revokeObjectURL(u.previewUrl));
  }, []);
  useEffect(() => {
    if (replyBump > prevReplyBump.current) setExpanded(true);
    prevReplyBump.current = replyBump;
  }, [replyBump]);

  useEffect(() => {
    if (autoExpandChain && message.replied) setExpanded(true);
  }, [autoExpandChain, message.replied, message.id]);

  useEffect(() => {
    if (!hasReplies || expanded) return;

    let cancelled = false;
    void fetchMessageReplies(message.id, 0, 1)
      .then(paged => {
        if (!cancelled) setReplyTotal(paged.total ?? 0);
      })
      .catch(() => {
        if (!cancelled) setReplyTotal(null);
      });

    return () => { cancelled = true; };
  }, [message.id, hasReplies, expanded, replyBump]);

  const startEdit = () => {
    setEditText(displayText);
    setEditFileIds(displayFileIds);
    setEditUploads(prev => {
      prev.forEach(u => URL.revokeObjectURL(u.previewUrl));
      return [];
    });
    setEditError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditText(displayText);
    setEditFileIds(displayFileIds);
    setEditUploads(prev => {
      prev.forEach(u => URL.revokeObjectURL(u.previewUrl));
      return [];
    });
    setEditError(null);
    setEditing(false);
  };

  const removeEditFile = (fileId: string) => {
    setEditFileIds(prev => prev.filter(id => id !== fileId));
  };

  const removeEditUpload = (localId: string) => {
    setEditUploads(prev => {
      const target = prev.find(u => u.localId === localId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(u => u.localId !== localId);
    });
  };

  const handleEditFiles = (list: FileList | null) => {
    if (!list?.length || savingEdit) return;
    const remaining = DISCUSSION_MESSAGE_MAX_FILES - editSlotCount;
    if (remaining <= 0) {
      setEditError(`Не больше ${DISCUSSION_MESSAGE_MAX_FILES} фото`);
      return;
    }
    const images = filterImageFiles(list).slice(0, remaining);
    if (!images.length) {
      setEditError('Можно прикладывать только изображения');
      return;
    }
    setEditError(null);
    const placeholders = images.map(file => ({
      localId: `edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      previewUrl: URL.createObjectURL(file),
      file,
    }));
    setEditUploads(prev => [
      ...prev,
      ...placeholders.map(({ localId, previewUrl }) => ({ localId, previewUrl })),
    ]);

    for (const placeholder of placeholders) {
      void uploadFile(placeholder.file)
        .then(result => {
          setEditUploads(prev => {
            const target = prev.find(u => u.localId === placeholder.localId);
            if (target) URL.revokeObjectURL(target.previewUrl);
            return prev.filter(u => u.localId !== placeholder.localId);
          });
          setEditFileIds(prev => [...prev, result.id].slice(0, DISCUSSION_MESSAGE_MAX_FILES));
        })
        .catch(e => {
          const message = e instanceof Error ? e.message : 'Не удалось загрузить фото';
          setEditError(message);
          setEditUploads(prev => prev.map(u => (
            u.localId === placeholder.localId && !u.error
              ? { ...u, error: message }
              : u
          )));
        });
    }

    if (editFileInputRef.current) editFileInputRef.current.value = '';
  };

  const saveEdit = async () => {
    const trimmed = editText.trim();
    const lengthErr = textLengthError(trimmed.length, DISCUSSION_MESSAGE_MAX_LENGTH);
    if ((!trimmed && editFileIds.length === 0) || !currentAccountId || savingEdit || uploadingEdit) return;
    if (lengthErr) {
      setEditError(lengthErr);
      return;
    }
    const textSame = trimmed === displayText;
    const filesSame =
      editFileIds.length === displayFileIds.length
      && editFileIds.every((id, i) => id === displayFileIds[i]);
    if (textSame && filesSame) {
      setEditing(false);
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      await updateMessage({
        id: message.id,
        conversationId,
        messageText: trimmed,
        accountId: currentAccountId,
        replyTo: message.replyTo ?? null,
        fileIds: editFileIds,
      });
      setDisplayText(trimmed);
      setDisplayFileIds(editFileIds);
      setEditUploads(prev => {
        prev.forEach(u => URL.revokeObjectURL(u.previewUrl));
        return [];
      });
      setEditing(false);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSavingEdit(false);
    }
  };

  const performDelete = async () => {
    if (!canDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteMessage(message.id);
      setDeleteConfirmOpen(false);
      onDeleted?.(message.id);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Не удалось удалить');
      setDeleteConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const expandForFocus = Boolean(focusPathTail && focusPathTail.length > 0);
  const showNestedReplies = canNestReplies && (hasReplies || expandForFocus);
  const collapsedRepliesLabel = replyTotal != null && replyTotal > 0
    ? formatReplyCount(replyTotal)
    : 'Есть ответы';
  const isLongText = isLongMessageText(displayText);

  const openAuthorProfile = () => {
    if (!accountId) return;
    navigate(isMine ? '/user/me' : `/user/${accountId}`);
  };

  const applyVoteResult = (result: {
    likesCount: number;
    dislikesCount: number;
    currentUserVote: MessageVoteValue | null;
  }) => {
    setLikesCount(result.likesCount);
    setDislikesCount(result.dislikesCount);
    setUserVote(result.currentUserVote);
  };

  const handleLike = async () => {
    if (!currentAccountId || voting || isHidden) return;
    setVoting(true);
    try {
      applyVoteResult(await likeMessage(message.id));
    } catch {
      /* toast via apiClient */
    } finally {
      setVoting(false);
    }
  };

  const handleDislike = async () => {
    if (!currentAccountId || voting || isHidden) return;
    setVoting(true);
    try {
      applyVoteResult(await dislikeMessage(message.id));
    } catch {
      /* toast via apiClient */
    } finally {
      setVoting(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <article
        id={discussionMessageDomId(message.id)}
        className={`${styles.card} ${isMine ? styles.cardMine : ''} ${highlighted ? styles.cardHighlight : ''} ${highlighted ? styles.cardReplyTarget : ''} ${focusTarget ? styles.cardFocusTarget : ''}`}
      >
        <div className={styles.cardInner}>
          {accountId ? (
            <button
              type="button"
              className={styles.avatarBtn}
              onClick={openAuthorProfile}
              aria-label={`Профиль: ${messageAuthorName(message)}`}
            >
              <UserAvatar
                accountId={accountId}
                avatarId={message.account?.avatarId ?? null}
                initials={initials}
                size={28}
                className={styles.avatar}
              />
            </button>
          ) : (
            <div className={styles.avatarFallback} aria-hidden>
              {initials}
            </div>
          )}
          <div className={styles.content}>
            <header className={styles.head}>
              {accountId ? (
                <button
                  type="button"
                  className={styles.authorBtn}
                  onClick={openAuthorProfile}
                >
                  {messageAuthorName(message)}
                </button>
              ) : (
                <span className={styles.author}>{messageAuthorName(message)}</span>
              )}
              {isMine && <span className={styles.you}>вы</span>}
              <time className={styles.time}>{formatMessageDate(message.createDate)}</time>
            </header>

            {isHidden ? (
              <p className={styles.hiddenStub}>Сообщение скрыто модерацией</p>
            ) : editing ? (
              <div className={styles.editBlock}>
                <textarea
                  className={styles.editInput}
                  rows={3}
                  value={editText}
                  disabled={savingEdit || uploadingEdit}
                  maxLength={DISCUSSION_MESSAGE_MAX_LENGTH}
                  onChange={(e) => setEditText(clampText(e.target.value, DISCUSSION_MESSAGE_MAX_LENGTH))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      void saveEdit();
                    }
                  }}
                />
                {(editFileIds.length > 0 || editUploads.length > 0) && (
                  <div className={styles.gallery}>
                    {editFileIds.map(fileId => (
                      <div key={fileId} className={styles.editShot}>
                        <AuthImage fileId={fileId} alt="" className={styles.galleryImg} />
                        <button
                          type="button"
                          className={styles.editShotRemove}
                          aria-label="Убрать фото"
                          disabled={savingEdit || uploadingEdit}
                          onClick={() => removeEditFile(fileId)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {editUploads.map(item => (
                      <div
                        key={item.localId}
                        className={`${styles.editShot} ${!item.error ? styles.editShotUploading : ''}`}
                        aria-busy={!item.error}
                        aria-label={item.error ? 'Ошибка загрузки' : 'Загрузка фото'}
                      >
                        <img
                          src={item.previewUrl}
                          alt=""
                          className={`${styles.galleryImg} ${styles.editShotImgDim}`}
                        />
                        {item.error ? (
                          <button
                            type="button"
                            className={styles.editShotError}
                            title={item.error}
                            onClick={() => removeEditUpload(item.localId)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                          </button>
                        ) : (
                          <div className={styles.editShotOverlay}>
                            <div className={styles.editShotSpinner} aria-hidden />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className={styles.editAttachRow}>
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className={styles.fileInputHidden}
                    disabled={savingEdit || editSlotCount >= DISCUSSION_MESSAGE_MAX_FILES}
                    onChange={(e) => handleEditFiles(e.target.files)}
                  />
                  <button
                    type="button"
                    className={styles.actionBtn}
                    disabled={savingEdit || editSlotCount >= DISCUSSION_MESSAGE_MAX_FILES}
                    onClick={() => editFileInputRef.current?.click()}
                  >
                    {uploadingEdit
                      ? `Загрузка… (${editUploads.filter(u => !u.error).length})`
                      : 'Фото'}
                  </button>
                  {(editFileIds.length > 0 || editUploads.length > 0) && (
                    <span className={styles.editAttachCount}>
                      {editFileIds.length}/{DISCUSSION_MESSAGE_MAX_FILES}
                    </span>
                  )}
                </div>
                {editError && <p className={styles.editError}>{editError}</p>}
                <div className={styles.editActions}>
                  <button type="button" className={styles.actionBtn} disabled={savingEdit || uploadingEdit} onClick={cancelEdit}>
                    Отмена
                  </button>
                  <div className={styles.saveRow}>
                    <TextLengthHint length={editText.length} maxLength={DISCUSSION_MESSAGE_MAX_LENGTH} />
                    <button
                    type="button"
                    className={styles.saveBtn}
                    disabled={
                      savingEdit
                      || uploadingEdit
                      || (!editText.trim() && editFileIds.length === 0)
                      || editText.trim().length > DISCUSSION_MESSAGE_MAX_LENGTH
                    }
                    onClick={() => void saveEdit()}
                  >
                    {savingEdit ? 'Сохранение…' : 'Сохранить'}
                  </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {replyToAuthor && (
                  <div className={styles.replyToChip}>
                    в ответ <span className={styles.replyToName}>{replyToAuthor}</span>
                  </div>
                )}
                {displayText.trim() && (
                  <p className={`${styles.text} ${isLongText && !textExpanded ? styles.textClamped : ''}`}>
                    {displayText}
                  </p>
                )}
                {isLongText && (
                  <button
                    type="button"
                    className={styles.textToggle}
                    onClick={() => setTextExpanded(v => !v)}
                    aria-expanded={textExpanded}
                  >
                    <span className={styles.textToggleLine} aria-hidden />
                    <span className={styles.textToggleBody}>
                      <span className={styles.textToggleTitle}>
                        {textExpanded ? 'Свернуть' : 'Показать полностью'}
                      </span>
                      <span className={styles.textToggleHint}>
                        {textExpanded ? 'Скрыть комментарий' : 'Развернуть комментарий'}
                      </span>
                    </span>
                    {textExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  </button>
                )}
                {displayFileIds.length > 0 && (
                  <div className={styles.gallery} role="list">
                    {displayFileIds.map((fileId, index) => (
                      <button
                        key={fileId}
                        type="button"
                        className={styles.galleryItem}
                        role="listitem"
                        aria-label={`Фото ${index + 1}`}
                        onClick={() => setLightboxIdx(index)}
                      >
                        <AuthImage fileId={fileId} alt="" className={styles.galleryImg} />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {!editing && !isHidden && (
              <footer className={styles.foot}>
                {currentAccountId && (
                  <>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${userVote === 'like' ? styles.actionBtnActive : ''}`}
                      disabled={voting}
                      aria-pressed={userVote === 'like'}
                      aria-label="Нравится"
                      onClick={() => void handleLike()}
                    >
                      <LikeIcon />
                      {likesCount > 0 ? likesCount : null}
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${userVote === 'dislike' ? styles.actionBtnActive : ''}`}
                      disabled={voting}
                      aria-pressed={userVote === 'dislike'}
                      aria-label="Не нравится"
                      onClick={() => void handleDislike()}
                    >
                      <DislikeIcon />
                      {dislikesCount > 0 ? dislikesCount : null}
                    </button>
                  </>
                )}
                {!currentAccountId && (likesCount > 0 || dislikesCount > 0) && (
                  <span className={styles.voteReadonly} aria-label="Оценки комментария">
                    {likesCount > 0 && <span>▲ {likesCount}</span>}
                    {dislikesCount > 0 && <span>▼ {dislikesCount}</span>}
                  </span>
                )}
                {currentAccountId && onReply && (
                  <button type="button" className={styles.actionBtn} onClick={() => onReply?.(message, rootId)}>
                    <ReplyIcon />
                    Ответить
                  </button>
                )}
                {isMine && !isHidden && (
                  <button type="button" className={styles.actionBtn} onClick={startEdit}>
                    <EditIcon />
                    Редактировать
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                    disabled={deleting}
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    <DeleteIcon />
                    Удалить
                  </button>
                )}
                {canReport && (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    disabled={alreadyReported}
                    onClick={() => {
                      if (!alreadyReported) setReportOpen(true);
                    }}
                  >
                    <FlagIcon />
                    {alreadyReported ? 'Жалоба уже отправлена' : 'Пожаловаться'}
                  </button>
                )}
                {showNestedReplies && expanded && (
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionBtnMuted}`}
                    onClick={() => setExpanded(false)}
                  >
                    <ChevronUpIcon />
                    Скрыть ответы
                  </button>
                )}
              </footer>
            )}
            {deleteError && <p className={styles.deleteError}>{deleteError}</p>}
          </div>
        </div>
      </article>

      {deleteConfirmOpen && (
        <ConfirmDialog
          title="Удалить комментарий?"
          message="Комментарий будет удалён без возможности восстановления."
          confirmLabel={deleting ? 'Удаление…' : 'Удалить'}
          cancelLabel="Отмена"
          onConfirm={() => void performDelete()}
          onCancel={() => setDeleteConfirmOpen(false)}
        />
      )}

      {reportOpen && (
        <ContentReportModal
          targetType={ReportTargetType.Message}
          targetId={message.id}
          onClose={() => setReportOpen(false)}
          onSubmitted={() => setAlreadyReported(true)}
        />
      )}

      {showNestedReplies && !expanded && (
        <button
          type="button"
          className={styles.moreBtn}
          onClick={() => setExpanded(true)}
          aria-expanded={false}
        >
          {collapsedRepliesLabel}
        </button>
      )}

      {showNestedReplies && expanded && (
        <MessageReplies
          parent={message}
          depth={depth}
          refreshKey={replyBump}
          activeReplyId={activeReplyId}
          conversationId={conversationId}
          currentAccountId={currentAccountId}
          viewMode={viewMode}
          threadRootId={rootId}
          focusPathTail={focusPathTail}
          focusTargetId={focusTargetId}
          onFocusHandled={onFocusHandled}
          onReply={onReply}
          onDeleted={onDeleted}
          onTotalLoaded={setReplyTotal}
        />
      )}

      {lightboxIdx != null && displayFileIds.length > 0 && (
        <ImageLightbox
          fileIds={displayFileIds}
          startIndex={lightboxIdx}
          alt="Фото из комментария"
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  );
}
