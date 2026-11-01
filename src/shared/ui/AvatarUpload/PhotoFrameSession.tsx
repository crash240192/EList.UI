// Общий редактор кадра (аватар / логотип орг):
// новый файл и история — только при выборе фото; иначе только мета кадра.

import { useEffect, useRef, useState } from 'react';
import { fetchAuthedImage, uploadFile } from '@/shared/api/fileStorageClient';
import { loadAvatarCropMeta, saveAvatarCropMeta } from '@/entities/user/avatarApi';
import {
  DEFAULT_AVATAR_CROP_FRAME,
  normalizeAvatarCropFrame,
  type AvatarCropFrame,
} from './cropAvatar';
import { AvatarCropDialog, type AvatarCropShape } from './AvatarCropDialog';

export interface PhotoFrameSessionProps {
  open: boolean;
  fileId: string | null;
  onClose: () => void;
  onChanged: (fileId: string | null) => void;
  /** Назначить файл текущим (setNew / история). */
  assignFile: (fileId: string) => Promise<void>;
  /** Удалить текущий файл. Нет колбэка — без кнопки «Удалить». */
  deleteFile?: (fileId: string) => Promise<void>;
  shape?: AvatarCropShape;
  title?: string;
  lead?: string;
  emptyFileName?: string;
}

export function PhotoFrameSession({
  open,
  fileId,
  onClose,
  onChanged,
  assignFile,
  deleteFile,
  shape = 'circle',
  title = 'Кадр аватара',
  lead = 'Перетащите фото и подгоните масштаб. В круг попадёт то, что видно в окне.',
  emptyFileName = 'avatar',
}: PhotoFrameSessionProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState(emptyFileName);
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
        // Старые файлы без меты — кадрируем то, что есть.
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
        setFileName(emptyFileName);
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
  }, [open, fileId, emptyFileName]);

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
    setFileName(file.name || emptyFileName);
  };

  const onDelete = deleteFile
    ? async () => {
      setDeleting(true);
      try {
        const savedId = savedIdRef.current;
        if (savedId) {
          await deleteFile(savedId);
          savedIdRef.current = null;
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
    }
    : undefined;

  const onConfirm = async ({ frame }: { frame: AvatarCropFrame }) => {
    setSaving(true);
    try {
      const localOriginal = localFileRef.current;
      const nextFrame = normalizeAvatarCropFrame(frame);

      if (localOriginal) {
        const uploadedSource = await uploadFile(localOriginal);
        const sourceFileId = uploadedSource.id;
        await saveAvatarCropMeta(sourceFileId, sourceFileId, nextFrame);
        await assignFile(sourceFileId);
        savedIdRef.current = sourceFileId;
        sourceFileIdRef.current = sourceFileId;
        localFileRef.current = null;
        onChanged(sourceFileId);
        onClose();
        return;
      }

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
      shape={shape}
      title={title}
      lead={lead}
      deleteDisabled={!src && !fileId}
      onFilePicked={onFilePicked}
      onDelete={onDelete}
      onCancel={() => { if (!saving && !deleting) onClose(); }}
      onConfirm={onConfirm}
    />
  );
}
