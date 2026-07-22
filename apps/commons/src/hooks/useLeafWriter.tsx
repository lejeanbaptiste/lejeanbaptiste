import { reapplyCachedTagColors, scheduleTagColorsInjection } from '@src/desktop/tagging/tagColors';
import { DESKTOP_APP_DISPLAY_NAME } from '@src/desktop/desktopBranding';
import { registerLeafWriterCommonsI18n } from '@src/desktop/registerLeafWriterCommonsI18n';
import { focusFirstBodyParagraph } from '@src/desktop/focusFirstBodyParagraph';
import { prepareDesktopDocument } from '@src/desktop/resolveDocumentSchemas';
import { registerDesktopSchemas } from '@src/desktop/registerDesktopSchemas';
import {
  mergeEditorBodyWithStoredHeader,
  mergeStoredHeaderForValidation,
  stripTeiHeaderForVisualEditor,
} from '@src/desktop/teiHeaderXml';
import { separateBlockElements } from '@src/desktop/xmlBlockSpacing';
import { ENABLED_CATALOG_IDS, getEnabledCatalogSchemas } from '@src/desktop/schemaCatalog';
import { unlockAchievement } from '@src/desktop/achievements/engine';
import {
  leafwriterAtom,
  leafWriterEventsAtom,
  leafWriterSessionKeyAtom,
  tapDocumentTimerAtom,
} from '@src/jotai';
import { useActions, useAppState } from '@src/overmind';
import { convertDocument } from '@src/services/leaf-te';
import type { Resource } from '@src/types';
import { isDesktop } from '@src/types/desktop';
import { changeFileExtension } from '@src/utilities';
import { useAtom, useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAnalytics } from './useAnalytics';
import type { Types } from '@cwrc/leafwriter';
import { SETTINGS_BOOTSTRAP_URL } from '@cwrc/leafwriter';
import { schemas } from '@src/config/schemas';
import type { WorkspaceCursorPosition } from '@src/types/desktop';

type LeafWriterOptionsSettings = Types.LeafWriterOptionsSettings;

const SETTINGS_BOOTSTRAP_XML =
  '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p/></body></text></TEI>';

const waitForWriter = async (timeoutMs = 5000): Promise<boolean> => {
  const started = Date.now();
  while (!window.writer) {
    if (Date.now() - started > timeoutMs) return false;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  return true;
};

const showDefaultEastPanel = () => {
  if (!isDesktop()) return;
  window.writer?.layoutManager?.showModule('fileMetadata');
  const editorId = window.writer?.editorId;
  if (editorId) {
    window.dispatchEvent(new CustomEvent('lw:east-tabs-ready', { detail: { editorId } }));
  }
};

const restoreCursorPositionWhenReady = (position: WorkspaceCursorPosition) => {
  const delays = [0, 100, 300, 700, 1200, 2000];

  const tryRestore = async (remainingDelays: number[], attempt = 1) => {
    const restored = await window.__leafWriterCursorSession?.restore(position);
    if (restored || remainingDelays.length === 0) return;

    const [delay, ...next] = remainingDelays;
    window.setTimeout(() => {
      void tryRestore(next, attempt + 1);
    }, delay);
  };

  void tryRestore(delays);
};

export const useLeafWriter = () => {
  const { analytics } = useAnalytics();
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (isDesktop() && typeof window !== 'undefined') {
    window.__desktopStripTeiHeaderForVisualEditor = stripTeiHeaderForVisualEditor;
    window.__desktopMergeEditorBodyWithStoredHeader = (editorXml: string, storedXml?: string) => {
      const stored =
        storedXml ??
        window.__desktopStoredDocumentXml ??
        window.writer?.overmindState?.document?.xml ??
        '';
      return mergeEditorBodyWithStoredHeader(stripTeiHeaderForVisualEditor(editorXml), stored);
    };
    window.__desktopMergeHeaderForValidation = (editorXml: string) => {
      const stored =
        window.__desktopStoredDocumentXml ?? window.writer?.overmindState?.document?.xml ?? '';
      // Block spacing here (not just at disk-save) so the Source-mode buffer — which is
      // regenerated from the editor's run-on serializer output through this bridge — shows
      // the same one-block-per-line layout the saved file gets.
      return separateBlockElements(mergeStoredHeaderForValidation(editorXml, stored));
    };
  }

  const { user } = useAppState().auth;
  const { config, cursorPositions, projectSchemas, rootPath } = useAppState().project;
  const { autosave, contentHasChanged, readonly, resource, timerService } = useAppState().editor;
  const { currentLocale } = useAppState().ui;

  const {
    close,
    loadLeafWriter,
    resetLibLoaded,
    save,
    saveAs,
    setResource,
    setAutosave,
    setContentLastSaved,
    setContentHasChanged,
    subscribeToTimerService,
    unsubscribeFromTimerService,
  } = useActions().editor;
  const { addToRecentDocument, download } = useActions().storage;
  const { updateTabContent } = useActions().project;
  const { notifyViaSnackbar, openDialog } = useActions().ui;

  const [leafWriter, setLeafWriter] = useAtom(leafwriterAtom);
  const [leafWriterEvent, setLeafWriterEvents] = useAtom(leafWriterEventsAtom);
  const [tapDocumentTimer, setTapDocumentTimer] = useAtom(tapDocumentTimerAtom);
  const bumpEditorSession = useSetAtom(leafWriterSessionKeyAtom);

  const canAutosaveResource = Boolean(resource?.provider || (isDesktop() && resource?.filePath));

  useEffect(() => {
    if (!isDesktop() || !rootPath || !leafWriter) return;

    const injectColors = () => {
      if (!reapplyCachedTagColors(rootPath)) {
        scheduleTagColorsInjection(rootPath);
      }
    };

    const attach = () => {
      const writer = window.writer;
      if (!writer) return undefined;

      const events = [
        'documentLoaded',
        'tinymceInitialized',
        'schemaLoaded',
        'writerInitialized',
      ] as const;
      for (const eventName of events) {
        writer.event(eventName).subscribe(injectColors);
      }
      injectColors();

      return () => {
        for (const eventName of events) {
          writer.event(eventName).unsubscribe(injectColors);
        }
      };
    };

    let detach = attach();
    const onWriterReady = () => {
      detach?.();
      detach = attach();
    };

    window.writer?.event('tinymceInitialized').subscribe(onWriterReady);

    if (!detach) {
      const retryId = window.setInterval(() => {
        if (!window.writer) return;
        detach = attach();
        if (detach) window.clearInterval(retryId);
      }, 100);
      return () => {
        window.clearInterval(retryId);
        detach?.();
        window.writer?.event('tinymceInitialized').unsubscribe(onWriterReady);
      };
    }

    return () => {
      detach?.();
      window.writer?.event('tinymceInitialized').unsubscribe(onWriterReady);
    };
  }, [leafWriter, rootPath]);

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

    let xml = resource.content ?? '';
    let documentSchemas = schemas;

    if (isDesktop() && resource.filePath && rootPath) {
      const prepared = await prepareDesktopDocument(
        resource.filePath,
        xml,
        rootPath,
        config?.schema,
      );
      xml = prepared.content;
      documentSchemas = [...projectSchemas, ...prepared.schemas];
      registerDesktopSchemas([
        ...getEnabledCatalogSchemas(),
        ...projectSchemas,
        ...prepared.schemas,
      ]);
      if (xml !== resource.content) {
        await setResource({ ...resource, content: xml });
        updateTabContent({ filePath: resource.filePath, content: xml });
      }
    }

    const settings: LeafWriterOptionsSettings = {
      locale: currentLocale,
      readonly,
      schemas: documentSchemas,
      ...(isDesktop()
        ? {
            baseUrl: `${window.location.origin}/`,
            schemasId: [...ENABLED_CATALOG_IDS],
            appDisplayName: DESKTOP_APP_DISPLAY_NAME,
            modules: {
              east: [
                { id: 'fileMetadata', title: 'File metadata' },
                { id: 'attributes', title: 'Attributes' },
                { id: 'validation', title: 'Validation' },
              ],
            },
          }
        : {}),
      // Telemetry is handled by the LWC. If want to test it on LW, you must disabled it on LWC (just do not initialize it)
    };

    const visualXml = isDesktop() ? stripTeiHeaderForVisualEditor(xml) : xml;

    leafWriter.init({
      document: {
        url: resource.filePath ?? resource.url,
        xml: visualXml,
      },
      settings,
      user: author,
    });

    if (isDesktop()) {
      window.writer?.overmindActions?.document?.setDocumentXml?.(xml);
    }

    setEditorEvents();

    if (analytics) {
      analytics.track('editor', { opened: true });
      analytics.page();
    }
  };

  /** Minimal editor bootstrap so settings and preferences work before any file is open. */
  const ensureLeafWriterReadyForSettings = async (): Promise<boolean> => {
    if (!isDesktop() || !leafWriter) return false;
    if (window.writer) return true;

    registerLeafWriterCommonsI18n();
    registerDesktopSchemas([...getEnabledCatalogSchemas(), ...projectSchemas]);

    const author = user && {
      name: user.identities.get(user.preferredID)?.name ?? `${user.firstName} ${user.lastName}`,
      uri: user?.identities.get(user.preferredID)?.uri ?? '',
    };

    const settings: LeafWriterOptionsSettings = {
      locale: currentLocale,
      readonly: false,
      schemas: [...projectSchemas, ...schemas],
      baseUrl: `${window.location.origin}/`,
      schemasId: [...ENABLED_CATALOG_IDS],
      appDisplayName: DESKTOP_APP_DISPLAY_NAME,
      modules: {
        east: [
          { id: 'fileMetadata', title: 'File metadata' },
          { id: 'attributes', title: 'Attributes' },
          { id: 'validation', title: 'Validation' },
        ],
      },
    };

    leafWriter.init({
      document: {
        url: SETTINGS_BOOTSTRAP_URL,
        xml: stripTeiHeaderForVisualEditor(SETTINGS_BOOTSTRAP_XML),
      },
      settings,
      user: author,
    });

    if (!leafWriter.onLoad.observed) {
      setEditorEvents();
    }

    return waitForWriter();
  };

  /** Load a different project file into an already-running editor (tab switch / second file). */
  const loadDocumentInWriter = async (
    filePath: string,
    content: string,
    cursorPosition?: WorkspaceCursorPosition | null,
  ) => {
    if (!window.writer) return;

    if (isDesktop() && rootPath && config?.schema) {
      const prepared = await prepareDesktopDocument(filePath, content, rootPath, config.schema);
      content = prepared.content;
      registerDesktopSchemas([
        ...getEnabledCatalogSchemas(),
        ...projectSchemas,
        ...prepared.schemas,
      ]);
    }

    window.writer.overmindActions?.ui?.resetSourceEditor?.();
    window.writer.overmindActions?.document?.setDocumentUrl?.(filePath);
    window.writer.loadDocumentXML(content);
    window.writer.overmindActions?.editor?.setContentHasChanged?.(false);
    window.writer.layoutManager?.resizeEditor?.();
    window.writer.layoutManager?.resizeAll?.();
    if (cursorPosition) {
      restoreCursorPositionWhenReady(cursorPosition);
    } else {
      focusFirstBodyParagraph();
    }
    showDefaultEastPanel();
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

      if (autosave && canAutosaveResource) timerService.start();
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
      if (
        isDesktop() &&
        config?.schema?.rng &&
        (!config.schema.catalogId ||
          !(ENABLED_CATALOG_IDS as readonly string[]).includes(config.schema.catalogId))
      ) {
        void unlockAchievement('make-your-own-rules', (message) =>
          notifyViaSnackbar({
            message,
            options: { variant: 'success', autoHideDuration: 7000 },
          }),
        );
      }
      subscribeToTimerService(leafWriter);
      if (isDesktop()) {
        const cursorPosition = resource.filePath ? cursorPositions[resource.filePath] : null;
        if (cursorPosition) {
          restoreCursorPositionWhenReady(cursorPosition);
        } else {
          focusFirstBodyParagraph();
        }
        showDefaultEastPanel();
      }
    });
    // leafWriterEvents.push(onLoadEvent);
    setLeafWriterEvents((prev) => [...prev, onLoadEvent]);

    const onCloseEvent = leafWriter.onClose.subscribe(() => {
      unsubscribeFromTimerService();

      if (isDesktop()) {
        const editor = leafWriter;
        removeSubscribers();
        timerService.stop();
        if (tapDocumentTimer) clearTimeout(tapDocumentTimer);

        void (async () => {
          editor.dispose();
          setLeafWriter(null);
          resetLibLoaded();
          bumpEditorSession((key) => key + 1);
          notifyViaSnackbar({
            message: 'Could not open this document.',
            options: { variant: 'warning' },
          });
        })();
        return;
      }

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

  useEffect(() => {
    if (!contentHasChanged) {
      timerService.stop();
      return;
    }

    if (autosave && canAutosaveResource) {
      timerService.start();
      return;
    }

    timerService.stop();
  }, [autosave, canAutosaveResource, contentHasChanged, timerService]);

  const removeSubscribers = () => {
    // leafWriterEvents.forEach((subs) => subs.unsubscribe());
    // leafWriterEvents = [];

    leafWriterEvent.forEach((subs) => subs.unsubscribe());
    setLeafWriterEvents([]);
  };

  const handleDownload = async (format: string) => {
    if (!leafWriter || !resource) return;
    const content = await getContent();
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
    const content = await leafWriter.getContent();
    if (isDesktop() && content && window.writer?.overmindState?.ui?.editorViewMode !== 'source') {
      const baseXml =
        window.__desktopStoredDocumentXml ??
        window.writer?.overmindState?.document?.xml ??
        resource.content ??
        content;
      return mergeEditorBodyWithStoredHeader(stripTeiHeaderForVisualEditor(content), baseXml);
    }
    return content;
  };

  const handleSave = async (action: 'save' | 'saveAs' = 'save') => {
    if (!leafWriter) return;

    const content = await getContent();
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
    ensureLeafWriterReadyForSettings,
    getDocumentRootName,
    getContent,
    handleCloseDocument,
    handleDownload,
    handleSave,
    initLeafWriter,
    loadDocumentInWriter,
    loadLib,
    saveFeedback,
    setEditorEvents,
    tapDocument,
  };
};
