import type { Leafwriter } from '@cwrc/leafwriter';
import { loadDocument } from '@cwrc/leafwriter-storage-service';
import { Typography } from '@mui/material';
import { usePermalink } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import { Resource } from '@src/types';
import { isErrorMessage } from '@src/utilities';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

let leafWriter: Leafwriter | null = null;
let tapDocumentTimer: NodeJS.Timeout;

let leafWriterEvents: any[] = [];

export const useLeafWriter = () => {
  const { autosave, contentHasChanged: isDirty, resource, timerService } = useAppState().editor;

  const {
    close,
    save,
    saveAs,
    setAutosave,
    setContentLastSaved,
    setContentHasChanged,
    setResource,
    subscribeToTimerService,
    unsubscribeFromTimerService,
  } = useActions().editor;
  const { getStorageProviderAuth } = useActions().providers;
  const { addToRecentDocument, download, loadSample } = useActions().storage;
  const { notifyViaSnackbar, openDialog } = useActions().ui;

  const navigate = useNavigate();
  const { t } = useTranslation('commons');

  const { getResourceFromPermalink } = usePermalink();

  useEffect(() => {
    leafWriter?.setContentHasChanged(isDirty);
  }, [isDirty]);

  const setCurrentLeafWriter = (lw: Leafwriter | null) => (leafWriter = lw);

  const setEditorEvents = () => {
    if (!leafWriter) return;

    if (leafWriter.onLoad.observed) removeSubscribers;

    const dirtyEvent = leafWriter.onContentHasChanged.subscribe(async (value) => {
      if (!leafWriter) return;
      setContentHasChanged(value);

      if (value === false) {
        timerService.stop();
        return;
      }

      if (autosave && resource?.provider) timerService.start();
    });
    leafWriterEvents.push(dirtyEvent);

    const onLoadEvent = leafWriter.onLoad.subscribe(({ schemaName }) => {
      if (!leafWriter || !resource) return;

      leafWriter.autosave = autosave;
      tapDocument(resource, schemaName);
      subscribeToTimerService(leafWriter);
    });
    leafWriterEvents.push(onLoadEvent);

    const onCloseEvent = leafWriter.onClose.subscribe(() => {
      unsubscribeFromTimerService();
      disposeLeafWriter();
    });
    leafWriterEvents.push(onCloseEvent);

    const onStateChangeEvent = leafWriter.onEditorStateChange.subscribe((editorState) => {
      if (editorState.autosave !== undefined && editorState.autosave !== autosave) {
        setAutosave(editorState.autosave);
      }
    });
    leafWriterEvents.push(onStateChangeEvent);
  };

  const removeSubscribers = () => {
    leafWriterEvents.forEach((subs) => subs.unsubscribe());
    leafWriterEvents = [];
  };

  const loadFromPermalink = async () => {
    const resource = await getResourceFromPermalink();

    if (!resource) return showErrorMessage(t('storage:warning.check_URL_structure'));

    if (isErrorMessage(resource)) {
      showErrorMessage(resource.message);
      return;
    }

    if (resource.category && resource.url) {
      const content = await loadSample(resource.url);
      setResource({ content, filename: `${resource.title}.xml` });
      return;
    }

    if (!resource.provider) return showErrorMessage(t('storage:provider_not_found'));

    const providerAuth = getStorageProviderAuth(resource.provider);
    if (!providerAuth) return showErrorMessage(t('storage:provider_not_found'));

    const document = await loadDocument(providerAuth, resource);
    if ('error' in document) return showErrorMessage(document.error);

    setResource(document);
  };

  const showErrorMessage = (message: string) => {
    openDialog({
      props: {
        maxWidth: 'xs',
        preventEscape: true,
        severity: 'error',
        title: `${t('storage:invalid_request')}`,
        Message: () => (
          <Typography sx={{ ':first-letter': { textTransform: 'uppercase' } }}>
            {message}
          </Typography>
        ),
        onClose: async () => disposeLeafWriter(),
      },
    });
  };

  const handleDownload = async () => {
    if (!leafWriter) return;
    const content = await leafWriter.getContent();
    download(content);
  };

  const handleSave = async (action: 'save' | 'saveAs' = 'save') => {
    if (!leafWriter) return;

    const content = await leafWriter.getContent();
    const screenshot = await leafWriter.getDocumentScreenshot();

    if (action === 'saveAs') {
      saveAs({ content, screenshot });
      return;
    }

    const saved = await save({ content, screenshot });

    if (!saved.success && saved.error?.message === 'conflict') return;

    const type = saved.success ? 'success' : saved.error?.type ?? 'info';
    const message = saved.success
      ? t('storage:document_saved')
      : `${t('error:something_went_wrong')}. ${t('storage:document_not_saved')}!`;

    if (saved.success) leafWriter.setContentHasChanged(false);

    notifyViaSnackbar({ message, options: { variant: type } });
  };

  const saveFeedback = (saved: boolean) => {
    const type = saved ? 'success' : 'error';
    const message = saved
      ? t('storage:document_saved')
      : `${t('error:something_went_wrong')}. ${t('storage:document_not_saved')}!`;

    notifyViaSnackbar({ message, options: { variant: type } });

    if (!leafWriter) return;
    if (saved) leafWriter.setContentHasChanged(false);
  };

  const handleCloseDocument = () => {
    if (!isDirty) return disposeLeafWriter();

    openDialog({
      props: {
        maxWidth: 'xs',
        preventEscape: true,
        severity: 'warning',
        title: `${t('unsaved_changes')}`,
        actions: [
          { action: 'cancel', label: `${t('cancel')}` },
          { action: 'discard', label: `${t('discard_changes')}` },
        ],
        //@ts-ignore
        onClose: async (action: string) => {
          if (action !== 'discard') return;
          disposeLeafWriter();
        },
      },
    });
  };

  const tapDocument = (resource: Resource, schemaName: string) => {
    tapDocumentTimer = setTimeout(async () => {
      if (!leafWriter || !resource) return;

      const content = await leafWriter.getContent();
      const screenshot = await leafWriter.getDocumentScreenshot();

      setContentLastSaved(content);
      addToRecentDocument({ ...resource, screenshot, schemaName });
    }, 5_000);
  };

  const disposeLeafWriter = () => {
    timerService.stop();
    clearTimeout(tapDocumentTimer);

    leafWriter?.dispose();
    leafWriter = null;

    navigate('/', { replace: true });

    close();
  };

  return {
    leafWriter,
    disposeLeafWriter,
    handleCloseDocument,
    handleDownload,
    handleSave,
    loadFromPermalink,
    saveFeedback,
    setEditorEvents,
    setCurrentLeafWriter,
    tapDocument,
  };
};
