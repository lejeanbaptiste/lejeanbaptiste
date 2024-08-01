import type { Leafwriter } from '@cwrc/leafwriter';
import { useActions, useAppState } from '@src/overmind';
import { convertDocument } from '@src/services/leafTe';
import type { Resource } from '@src/types';
import { changeFileExtension } from '@src/utilities';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

let leafWriter: Leafwriter | null = null;
let leafWriterEvents: any[] = [];
let tapDocumentTimer: NodeJS.Timeout;

export const useLeafWriter = () => {
  const { t } = useTranslation();
  const { autosave, contentHasChanged, readonly, resource, timerService } = useAppState().editor;

  const {
    close,
    save,
    saveAs,
    setAutosave,
    setContentLastSaved,
    setContentHasChanged,
    subscribeToTimerService,
    unsubscribeFromTimerService,
  } = useActions().editor;
  const { addToRecentDocument, download } = useActions().storage;
  const { notifyViaSnackbar, openDialog } = useActions().ui;

  const { t } = useTranslation('LWC');
  const navigate = useNavigate();

  useEffect(() => {
    leafWriter?.setContentHasChanged(contentHasChanged);
  }, [contentHasChanged]);

  useEffect(() => {
    leafWriter?.setReadonly(readonly);
  }, [readonly]);

  const setCurrentLeafWriter = (lw: Leafwriter | null) => (leafWriter = lw);

  const setEditorEvents = () => {
    if (!leafWriter) return;

    if (leafWriter.onLoad.observed) removeSubscribers;

    const dirtyEvent = leafWriter.onContentHasChanged.subscribe((value) => {
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

      if (leafWriter.isReload()) {
        // We got a reload event, possibly after a manual XML edit, don't tap the document,
        //since this would fake-update what was last saved and would create even more entries for last opened.
        return;
      }

      leafWriter.autosave = autosave;
      tapDocument(resource, schemaName);
      subscribeToTimerService(leafWriter);
    });
    leafWriterEvents.push(onLoadEvent);

    const onCloseEvent = leafWriter.onClose.subscribe(() => {
      unsubscribeFromTimerService();
      disposeLeafWriter();
      navigate('/', { replace: true });
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

  const handleDownload = async (format: string) => {
    if (!leafWriter || !resource) return;
    const content = await leafWriter.getContent();
    if (!content) return;

    if (format === 'xml') {
      const filename = resource.filename ?? 'untitled.xml';
      download({ content, filename });
      return;
    }

    const response = await convertDocument({
      content,
      fromType: 'TEI',
      toType: format,
    });

    if (response instanceof Error) {
      notifyViaSnackbar({
        message: `${t('LWC.commons.Conversion to HTML failed').toString()}. ${response.message}`,
        options: { variant: 'error' },
      });
      return;
    }

    const filename = changeFileExtension(resource.filename ?? 'untitle', format.toLowerCase());

    download({ content: response, filename });
  };

  const getDocumentRootName = () => {
    if (!leafWriter || !resource) return;
    return leafWriter.getDocumentRootName();
  };

  const getContent = async () => {
    if (!leafWriter || !resource) return;
    return await leafWriter.getContent();
  };

  const handleSave = async (action: 'save' | 'saveAs' = 'save') => {
    if (!leafWriter) return;

    const content = await leafWriter.getContent();
    if (!content) return;
    const screenshot = await leafWriter.getDocumentScreenshot();

    if (action === 'saveAs') {
      saveAs({ content, screenshot });
      return;
    }

    const saved = await save({ content, screenshot });

    if (!saved.success) {
      notifyViaSnackbar({
        message: `${saved.error.message}. ${t('LWC.storage.document_not_saved')}!`,
        options: { variant: saved.error.type },
      });
      return;
    }

    leafWriter.setContentHasChanged(false);

    notifyViaSnackbar({
      message: t('LWC.storage.document_saved'),
      options: { variant: 'success' },
    });
  };

  const saveFeedback = (saved: boolean) => {
    const type = saved ? 'success' : 'error';
    const message = saved
      ? t('LWC.storage.document_saved')
      : `${t('LWC.error.something_went_wrong')}. ${t('LWC.storage.document_not_saved')}!`;

    notifyViaSnackbar({ message, options: { variant: type } });

    if (!leafWriter) return;
    if (saved) leafWriter.setContentHasChanged(false);
  };

  const handleCloseDocument = () => {
    if (!contentHasChanged) {
      disposeLeafWriter();
      navigate('/', { replace: true });
      return;
    }

    openDialog({
      props: {
        maxWidth: 'xs',
        preventEscape: true,
        severity: 'warning',
        title: `${t('LWC.commons.unsaved_changes')}`,
        actions: [
          { action: 'cancel', label: `${t('LWC.commons.cancel')}` },
          { action: 'discard', label: `${t('LWC.commons.discard_changes')}` },
        ],
        onClose: async (action) => {
          if (action !== 'discard') return;
          disposeLeafWriter();
          navigate('/', { replace: true });
        },
      },
    });
  };

  const tapDocument = (resource: Resource, schemaName: string) => {
    tapDocumentTimer = setTimeout(async () => {
      if (!leafWriter || !resource) return;

      const content = await leafWriter.getContent();
      if (!content) return;
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

    close();
  };

  return {
    leafWriter,
    getDocumentRootName,
    disposeLeafWriter,
    getContent,
    handleCloseDocument,
    handleDownload,
    handleSave,
    saveFeedback,
    setEditorEvents,
    setCurrentLeafWriter,
    tapDocument,
  };
};
