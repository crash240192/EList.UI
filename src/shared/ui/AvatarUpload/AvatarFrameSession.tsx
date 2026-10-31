// Окно «Кадр аватара» для уже выбранного или текущего фото.
// В кадр подставляем исходник (если есть), а не предыдущий обрезанный JPEG.
// «Выбрать фото...» подменяет исходник, «Удалить» снимает сохранённый аватар.

import { useEffect, useRef, useState } from 'react';
import { fetchAuthedImage, uploadFile } from '@/shared/api/fileStorageClient';
import {
  deleteAvatar,
  loadAvatarSourceFileId,
  saveAvatarSourceLink,
  setAvatar,
} from '@/entities/user/avatarApi';
import { seedAvatarCache } from '@/features/auth/useAvatar';
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
      setLoadingImage(false);
      return;
    }
    savedIdRef.current = fileId;
    dropAllUrls();
    localFileRef.current = null;
    sourceFileIdRef.current = null;
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
      try {
        const sourceId = await loadAvatarSourceFileId(fileId);
        if (cancelled || pickGen.current !== gen) return;
        if (sourceId) {
          sourceFileIdRef.current = sourceId;
          loadId = sourceId;
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
        setSrc(url);
        setFileName('avatar');
      } catch {
        if (!cancelled && pickGen.current === gen) setSrc(null);
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
      setSrc(null);
    } finally {
      setDeleting(false);
    }
  };

  const onConfirm = async (file: File) => {
    setSaving(true);
    try {
      let sourceFileId = sourceFileIdRef.current;
      const localOriginal = localFileRef.current;
      if (localOriginal) {
        const uploadedSource = await uploadFile(localOriginal);
        sourceFileId = uploadedSource.id;
        sourceFileIdRef.current = sourceFileId;
        localFileRef.current = null;
      }

      const uploaded = await uploadFile(file);
      if (sourceFileId) {
        try {
          await saveAvatarSourceLink(uploaded.id, sourceFileId);
        } catch {
          // Кадр уже готов; без ссылки следующий раз откроется квадрат — не блокируем сохранение.
        }
      }
      await setAvatar(uploaded.id);
      seedAvatarCache(accountId, uploaded.id);
      savedIdRef.current = uploaded.id;
      onChanged(uploaded.id);
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
      deleteDisabled={!src && !fileId}
      onFilePicked={onFilePicked}
      onDelete={onDelete}
      onCancel={() => { if (!saving && !deleting) onClose(); }}
      onConfirm={onConfirm}
    />
  );
}
