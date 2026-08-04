import { useSearchParams } from 'react-router';
import { Box, Typography } from '@mui/material';
import { isDesktop } from '@src/types/desktop';
import type { ProjectMetadataDialogState } from '@src/desktop/projectMetadataDialogState';
import { ProjectMetadataForm } from '@src/desktop/projectMetadataEditor/ProjectMetadataForm';
import { createNativeProjectMetadataIO } from '@src/desktop/projectMetadataEditor/io';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const NativeProjectMetadataPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialDialogId = searchParams.get('dialogId') ?? '';
  const [activeDialogId, setActiveDialogId] = useState(initialDialogId);
  const [prefetchedState, setPrefetchedState] = useState<ProjectMetadataDialogState | null>(null);
  const [ready, setReady] = useState(initialDialogId === '__prewarm__' || !initialDialogId);

  const closeDialog = useCallback(() => {
    void window.electronAPI?.closeNativeDialog(activeDialogId);
  }, [activeDialogId]);

  const io = useMemo(() => {
    if (!activeDialogId || activeDialogId === '__prewarm__') return null;
    const nativeIo = createNativeProjectMetadataIO(activeDialogId, {
      onCancel: () => {
        void window.electronAPI?.nativeDialogInvoke({
          dialogId: activeDialogId,
          method: 'cancelProjectMetadata',
          args: { dialogId: activeDialogId },
        });
        closeDialog();
      },
      onSaved: closeDialog,
    });
    if (prefetchedState) {
      const originalLoad = nativeIo.loadState;
      nativeIo.loadState = async () => prefetchedState ?? originalLoad();
    }
    return nativeIo;
  }, [activeDialogId, closeDialog, prefetchedState]);

  useEffect(() => {
    if (!isDesktop()) return;
    const unsubOpen = window.electronAPI?.onNativeDialogOpen?.((payload) => {
      setActiveDialogId(payload.dialogId);
      setPrefetchedState((payload.initialState as ProjectMetadataDialogState | undefined) ?? null);
      setReady(true);
    });
    const unsubState = window.electronAPI?.onNativeDialogStateUpdate?.((payload) => {
      setPrefetchedState(payload.initialState as ProjectMetadataDialogState);
      setReady(true);
    });
    return () => {
      unsubOpen?.();
      unsubState?.();
    };
  }, []);

  useEffect(() => {
    if (!isDesktop() || !activeDialogId || activeDialogId === '__prewarm__') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      io?.onCancel?.();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [activeDialogId, io]);

  if (!isDesktop()) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t('LWC.desktop.only_available_desktop')}</Typography>
      </Box>
    );
  }

  if (!ready || !io) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary">{t('LWC.commons.loading')}</Typography>
      </Box>
    );
  }

  return <ProjectMetadataForm active io={io} layout="page" />;
};
