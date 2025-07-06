import { schemas } from '@src/config/schemas';
import { leafwriterAtom, leafWriterEventsAtom, tapDocumentTimerAtom } from '@src/jotai';
import { useActions, useAppState } from '@src/overmind';
import { convertDocument } from '@src/services/leaf-te';
import type { Resource } from '@src/types';
import { changeFileExtension } from '@src/utilities';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAnalytics } from './useAnalytics';
import type { LeafWriterOptionsSettings } from '@cwrc/leafwriter/lib/src/types';

export const useLeafWriter = () => {
  const { analytics } = useAnalytics();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { user } = useAppState().auth;
  const { autosave, contentHasChanged, readonly, resource, timerService } = useAppState().editor;
  const { currentLocale } = useAppState().ui;

  const {
    close,
    loadLeafWriter,
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

  const [leafWriter, setLeafWriter] = useAtom(leafwriterAtom);
  const [leafWriterEvent, setLeafWriterEvents] = useAtom(leafWriterEventsAtom);
  const [tapDocumentTimer, setTapDocumentTimer] = useAtom(tapDocumentTimerAtom);

  const loadLib = async (element: HTMLElement) => {
    const lw = await loadLeafWriter(element);
    setLeafWriter(lw);
  };

  const initLeafWriter = async () => {
    if (!leafWriter || !resource?.content) return;

    const author = user && {
      name: user.identities.get(user.preferredID)?.name ?? `${user.firstName} ${user.lastName}`,
      uri: user?.identities.get(user.preferredID)?.uri ?? '',
    };

    const settings: LeafWriterOptionsSettings = {
      locale: currentLocale,
      readonly,
      schemas,
    };

    leafWriter.init({
      document: {
        url: resource.url,
        xml: resource.content ?? '',
      },
      settings,
      user: author,
    });

    setEditorEvents();

    if (analytics) {
      analytics.track('editor', { opened: true });
      analytics.page();
    }
  };

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
    // leafWriterEvents.push(dirtyEvent);
    setLeafWriterEvents((prev) => [...prev, dirtyEvent]);

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
    // leafWriterEvents.push(onLoadEvent);
    setLeafWriterEvents((prev) => [...prev, onLoadEvent]);

    const onCloseEvent = leafWriter.onClose.subscribe(() => {
      unsubscribeFromTimerService();
      disposeLeafWriter();
      navigate('/', { replace: true });
    });
    // leafWriterEvents.push(onCloseEvent);
    setLeafWriterEvents((prev) => [...prev, onCloseEvent]);

    const onStateChangeEvent = leafWriter.onEditorStateChange.subscribe((editorState) => {
      if (editorState.autosave !== undefined && editorState.autosave !== autosave) {
        setAutosave(editorState.autosave);
      }
    });
    // leafWriterEvents.push(onStateChangeEvent);
    setLeafWriterEvents((prev) => [...prev, onStateChangeEvent]);
  };

  const removeSubscribers = () => {
    // leafWriterEvents.forEach((subs) => subs.unsubscribe());
    // leafWriterEvents = [];

    leafWriterEvent.forEach((subs) => subs.unsubscribe());
    setLeafWriterEvents([]);
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
    }).catch((error: Error) => error);

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
        title: t('LWC.commons.unsaved_changes'),
        actions: [
          { action: 'cancel', label: t('LWC.commons.cancel') },
          { action: 'discard', label: t('LWC.commons.discard changes') },
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
    setTapDocumentTimer(
      setTimeout(async () => {
        if (!leafWriter || !resource) return;

        const content = await leafWriter.getContent();
        if (!content) return;
        const screenshot = await leafWriter.getDocumentScreenshot();

        setContentLastSaved(content);
        addToRecentDocument({ ...resource, screenshot, schemaName });
      }, 5_000),
    );
  };

  const disposeLeafWriter = () => {
    timerService.stop();
    if (tapDocumentTimer) clearTimeout(tapDocumentTimer);

    leafWriter?.dispose();
    setLeafWriter(null);
    close();
  };

  return {
    disposeLeafWriter,
    getDocumentRootName,
    getContent,
    handleCloseDocument,
    handleDownload,
    handleSave,
    initLeafWriter,
    loadLib,
    saveFeedback,
    setEditorEvents,
    tapDocument,
  };
};
