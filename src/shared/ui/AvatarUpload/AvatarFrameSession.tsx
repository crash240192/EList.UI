// Окно «Кадр аватара» — модель как у шапки:
// новый файл в хранилище и запись в историю только при выборе нового фото;
// сдвиг/масштаб кадра сохраняются в description без upload и без setNew.

import { useEffect, useRef, useState } from 'react';
import { fetchAuthedImage, uploadFile } from '@/shared/api/fileStorageClient';
import {
  deleteAvatar,
  loadAvatarCropMeta,
  saveAvatarCropMeta,
  setAvatar,
} from '@/entities/user/avatarApi';
import { seedAvatarCache } from '@/features/auth/useAvatar';
import {
  DEFAULT_AVATAR_CROP_FRAME,
  normalizeAvatarCropFrame,
  type AvatarCropFrame,
} from './cropAvatar';
import { AvatarCropDialog } from './AvatarCropDialog';

interface AvatarFrameSessionProps {
  open: boolean;
  accountId: string;
  fileId: string | null;
  onClose: () => void;
  onChanged: (fileId: string | null) => void;
}

export function AvatarFrameSession({
  open,
  accountId,
  fileId,
  onClose,
  onChanged,
}: AvatarFrameSessionProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState('avatar');
  const [saving, setSaving] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [initialFrame, setInitialFrame] = useState<AvatarCropFrame | null>(null);
  const localUrlRef = useRef<string | null>(null);
  const remoteUrlRef = useRef<string | null>(null);
  const localFileRef = useRef<File | null>(null);
  const sourceFileIdRef = useRef<string | null>(null);
  const savedIdRef = useRef<string | null>(fileId);
  const pickGen = useRef(0);

  const dropLocal = () => {
    if (localUrlRef.current) {
      URL.revokeObjectURL(localUrlRef.current);
      localUrlRef.current = null;
    }
    localFileRef.current = null;
  };

  const dropRemote = () => {
    if (!remoteUrlRef.current) return;
    URL.revokeObjectURL(remoteUrlRef.current);
    remoteUrlRef.current = null;
  };

  const dropAllUrls = () => {
    dropLocal();
    dropRemote();
  };

  useEffect(() => {
    if (!open) {
      dropAllUrls();
      localFileRef.current = null;
      sourceFileIdRef.current = null;
      setSrc(null);
      setInitialFrame(null);
      setLoadingImage(false);
      return;
    }
    savedIdRef.current = fileId;
    dropAllUrls();
    localFileRef.current = null;
    sourceFileIdRef.current = null;
    setInitialFrame(null);
    if (!fileId) {
      setSrc(null);
      setLoadingImage(false);
      return;
    }
    let cancelled = false;
    const gen = pickGen.current;
    setLoadingImage(true);
    setSrc(null);

    void (async () => {
      let loadId = fileId;
      let frame: AvatarCropFrame | null = null;
      try {
        const meta = await loadAvatarCropMeta(fileId);
        if (cancelled || pickGen.current !== gen) return;
        if (meta?.sourceFileId) {
          sourceFileIdRef.current = meta.sourceFileId;
          loadId = meta.sourceFileId;
          frame = normalizeAvatarCropFrame(meta.frame);
        }
      } catch {
        // Нет контекста исходника — кадрируем то, что есть (старые аватары).
      }

      try {
        const url = await fetchAuthedImage(loadId, { fullSize: true });
        if (cancelled || pickGen.current !== gen) {
          URL.revokeObjectURL(url);
          return;
        }
        dropRemote();
        remoteUrlRef.current = url;
        setInitialFrame(frame);
        setSrc(url);
        setFileName('avatar');
      } catch {
        if (!cancelled && pickGen.current === gen) {
          setSrc(null);
          setInitialFrame(null);
        }
      } finally {
        if (!cancelled && pickGen.current === gen) setLoadingImage(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, fileId]);

  useEffect(() => () => dropAllUrls(), []);

  if (!open) return null;

  const onFilePicked = (file: File) => {
    pickGen.current += 1;
    dropAllUrls();
    sourceFileIdRef.current = null;
    const url = URL.createObjectURL(file);
    localUrlRef.current = url;
    localFileRef.current = file;
    setLoadingImage(false);
    setInitialFrame(DEFAULT_AVATAR_CROP_FRAME);
    setSrc(url);
    setFileName(file.name || 'avatar');
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      const savedId = savedIdRef.current;
      if (savedId) {
        await deleteAvatar(savedId);
        savedIdRef.current = null;
        seedAvatarCache(accountId, null);
        onChanged(null);
      }
      dropAllUrls();
      localFileRef.current = null;
      sourceFileIdRef.current = null;
      setInitialFrame(null);
      setSrc(null);
    } finally {
      setDeleting(false);
    }
  };

  const onConfirm = async ({ frame }: { frame: AvatarCropFrame }) => {
    setSaving(true);
    try {
      const localOriginal = localFileRef.current;
      const nextFrame = normalizeAvatarCropFrame(frame);

      // Новый файл — один upload исходника + setNew (история). Кроп JPEG не создаём.
      if (localOriginal) {
        const uploadedSource = await uploadFile(localOriginal);
        const sourceFileId = uploadedSource.id;
        await saveAvatarCropMeta(sourceFileId, sourceFileId, nextFrame);
        await setAvatar(sourceFileId);
        seedAvatarCache(accountId, sourceFileId);
        savedIdRef.current = sourceFileId;
        sourceFileIdRef.current = sourceFileId;
        localFileRef.current = null;
        onChanged(sourceFileId);
        onClose();
        return;
      }

      // Только кадр — обновляем description, без upload и без новой записи в истории.
      const avatarFileId = savedIdRef.current;
      if (!avatarFileId) {
        throw new Error('Сначала выберите фото');
      }
      const sourceFileId = sourceFileIdRef.current ?? avatarFileId;
      await saveAvatarCropMeta(avatarFileId, sourceFileId, nextFrame);
      onChanged(avatarFileId);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AvatarCropDialog
      src={src}
      fileName={fileName}
      saving={saving || deleting}
      loadingImage={loadingImage}
      initialFrame={initialFrame}
      exportCroppedFile={false}
      deleteDisabled={!src && !fileId}
      onFilePicked={onFilePicked}
      onDelete={onDelete}
      onCancel={() => { if (!saving && !deleting) onClose(); }}
      onConfirm={onConfirm}
    />
  );
}
