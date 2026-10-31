// Окно «Кадр аватара» для уже выбранного или текущего фото.
// «Выбрать фото...» подменяет кадр, «Удалить» снимает сохранённый аватар.

import { useEffect, useRef, useState } from 'react';
import { fetchAuthedImage, uploadFile } from '@/shared/api/fileStorageClient';
import { deleteAvatar, setAvatar } from '@/entities/user/avatarApi';
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
  const savedIdRef = useRef<string | null>(fileId);
  const pickGen = useRef(0);

  const dropLocal = () => {
    if (!localUrlRef.current) return;
    URL.revokeObjectURL(localUrlRef.current);
    localUrlRef.current = null;
  };

  useEffect(() => {
    if (!open) {
      dropLocal();
      setSrc(null);
      setLoadingImage(false);
      return;
    }
    savedIdRef.current = fileId;
    dropLocal();
    if (!fileId) {
      setSrc(null);
      setLoadingImage(false);
      return;
    }
    let cancelled = false;
    let loaded: string | null = null;
    const gen = pickGen.current;
    setLoadingImage(true);
    setSrc(null);
    fetchAuthedImage(fileId, { fullSize: true })
      .then(url => {
        if (cancelled || pickGen.current !== gen) {
          URL.revokeObjectURL(url);
          return;
        }
        loaded = url;
        setSrc(url);
        setFileName('avatar');
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingImage(false);
      });
    return () => {
      cancelled = true;
      if (loaded) URL.revokeObjectURL(loaded);
    };
  }, [open, fileId]);

  useEffect(() => () => dropLocal(), []);

  if (!open) return null;

  const onFilePicked = (file: File) => {
    pickGen.current += 1;
    dropLocal();
    const url = URL.createObjectURL(file);
    localUrlRef.current = url;
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
      dropLocal();
      setSrc(null);
    } finally {
      setDeleting(false);
    }
  };

  const onConfirm = async (file: File) => {
    setSaving(true);
    try {
      const uploaded = await uploadFile(file);
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
