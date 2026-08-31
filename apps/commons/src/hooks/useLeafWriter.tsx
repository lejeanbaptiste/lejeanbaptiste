import { reapplyCachedTagColors, scheduleTagColorsInjection } from '@src/desktop/tagging/tagColors';
import { DESKTOP_APP_DISPLAY_NAME } from '@src/desktop/desktopBranding';
import { runEditorBoot } from '@src/desktop/editorBootQueue';
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
import { shouldOpenTeiInSourceMode } from '@src/desktop/teiMilestoneHeuristics';
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
import { getDefaultStore, useAtom, useSetAtom } from 'jotai';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAnalytics } from './useAnalytics';
import type { Types } from '@cwrc/leafwriter';
import { SETTINGS_BOOTSTRAP_URL } from '@cwrc/leafwriter';
import { schemas } from '@src/config/schemas';
import type { WorkspaceCursorPosition } from '@src/types/desktop';

type LeafWriterOptionsSettings = Types.LeafWriterOptionsSettings;
type PreparedDesktopDocument = Awaited<ReturnType<typeof prepareDesktopDocument>>;

const SETTINGS_BOOTSTRAP_XML =
  '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p/></body></text></TEI>';

/** True once TinyMCE has finished booting (not merely when `window.writer` exists). */
export const isWriterReady = (): boolean => Boolean(window.writer?.isInitialized);

/**
 * Wait until the visual editor is actually ready to load documents.
 * `window.writer` is assigned before TinyMCE finishes; callers must wait for
 * `isInitialized` or document load can hang in `clearDocument`.
 */
export const waitForWriter = async (timeoutMs = 15_000): Promise<boolean> => {
  const started = Date.now();
  while (!isWriterReady()) {
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
      // Used for Visual-mode validation / Source sync: reattach stored teiHeader
      // to body-only editor XML. Source-mode validate() skips this merge so the
      // Monaco buffer (including header edits) is checked as-is.
      return separateBlockElements(mergeStoredHeaderForValidation(editorXml, stored));
    };
  }

  const { user } = useAppState().auth;
  const { config, cursorPositions, projectSchemas, rootPath } = useAppState().project;
  const { contentHasChanged, readonly, resource } = useAppState().editor;
  const { currentLocale } = useAppState().ui;

  const {
    close,
    loadLeafWriter,
    resetLibLoaded,
    save,
    saveAs,
    setResource,
    setContentLastSaved,
    setContentHasChanged,
  } = useActions().editor;
  const { addToRecentDocument, download } = useActions().storage;
  const { updateTabContent } = useActions().project;
  const { notifyViaSnackbar, openDialog } = useActions().ui;

  const [leafWriter, setLeafWriter] = useAtom(leafwriterAtom);
  const [leafWriterEvent, setLeafWriterEvents] = useAtom(leafWriterEventsAtom);
  const [tapDocumentTimer, setTapDocumentTimer] = useAtom(tapDocumentTimerAtom);
  const bumpEditorSession = useSetAtom(leafWriterSessionKeyAtom);
  // Project schema resolution reads schema/CSS files and may rewrite processing
  // instructions. The first editor load previously prepared the active tab in
  // initLeafWriter and immediately prepared it again in loadDocumentInWriter.
  // Cache by project + file + exact content so the two stages share that work;
  // a saved or externally changed document naturally misses the cache.
  const preparedDocumentsRef = useRef(
    new Map<string, { source: string; prepared: PreparedDesktopDocument }>(),
  );

  const prepareProjectDocument = async (filePath: string, content: string) => {
    const cacheKey = `${rootPath ?? ''}\u0000${filePath}`;
    const cached = preparedDocumentsRef.current.get(cacheKey);
    if (cached && (cached.source === content || cached.prepared.content === content)) {
      return cached.prepared;
    }

    const prepared = await prepareDesktopDocument(filePath, content, rootPath, config?.schema);
    if (!preparedDocumentsRef.current.has(cacheKey) && preparedDocumentsRef.current.size >= 4) {
      const oldestKey = preparedDocumentsRef.current.keys().next().value;
      if (oldestKey) preparedDocumentsRef.current.delete(oldestKey);
    }
    preparedDocumentsRef.current.set(cacheKey, { source: content, prepared });
    return prepared;
  };

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

  const loadLib = async (element: HTMLElement): Promise<boolean> => {
    return runEditorBoot('loadLib', async () => {
      // Another queued boot may have finished while we waited.
      if (getDefaultStore().get(leafwriterAtom) || window.writer) return true;

      try {
        const lw = await loadLeafWriter(element);
        setLeafWriter(lw);
        return true;
      } catch (error) {
        console.error('[editor] Failed to load Leaf-Writer library', error);
        return false;
      }
    });
  };

  const initLeafWriter = async (override?: {
    filePath: string;
    content: string;
    shouldApply?: () => boolean;
  }): Promise<boolean> => {
    return runEditorBoot('initLeafWriter', async () => {
      const filePath = override?.filePath ?? resource?.filePath;
      const rawContent = override?.content ?? resource?.content;
      const activeLeafWriter = getDefaultStore().get(leafwriterAtom) ?? leafWriter;
      if (!activeLeafWriter || !rawContent || !filePath) return false;
      if (override?.shouldApply && !override.shouldApply()) return false;

      // A half-booted writer with the same URL used to skip App.setup. Signal
      // failure so the shell can tear down and remount cleanly.
      if (window.writer && !isWriterReady()) {
        console.warn('[editor-boot] refusing init on half-booted writer');
        return false;
      }

      const author = user && {
        name: user.identities.get(user.preferredID)?.name ?? `${user.firstName} ${user.lastName}`,
        uri: user?.identities.get(user.preferredID)?.uri ?? '',
      };

      let xml = rawContent;
      let documentSchemas = schemas;

      if (isDesktop() && filePath && rootPath) {
        const prepared = await prepareProjectDocument(filePath, xml);
        if (override?.shouldApply && !override.shouldApply()) return false;
        xml = prepared.content;
        documentSchemas = [...projectSchemas, ...prepared.schemas];
        registerDesktopSchemas([
          ...getEnabledCatalogSchemas(),
          ...projectSchemas,
          ...prepared.schemas,
        ]);
        if (resource && xml !== resource.content && resource.filePath === filePath) {
          await setResource({ ...resource, content: xml });
          updateTabContent({ filePath, content: xml });
        }
      }

      if (override?.shouldApply && !override.shouldApply()) return false;

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
      };

      const sourceOnly =
        isDesktop() && Boolean(filePath && shouldOpenTeiInSourceMode(xml, filePath));
      const visualXml = sourceOnly
        ? stripTeiHeaderForVisualEditor(SETTINGS_BOOTSTRAP_XML)
        : isDesktop()
          ? stripTeiHeaderForVisualEditor(xml)
          : xml;

      activeLeafWriter.init({
        document: {
          url: filePath ?? resource?.url,
          xml: visualXml,
        },
        settings,
        user: author,
      });

      if (isDesktop()) {
        window.__desktopStoredDocumentXml = xml;
        window.writer?.overmindActions?.document?.setDocumentXml?.(xml);
      }

      setEditorEvents();

      if (analytics) {
        analytics.track('editor', { opened: true });
        analytics.page();
      }

      return waitForWriter();
    });
  };

  /** Minimal editor bootstrap so settings and preferences work before any file is open. */
  const ensureLeafWriterReadyForSettings = async (): Promise<boolean> => {
    return runEditorBoot('ensureLeafWriterReadyForSettings', async () => {
      if (!isDesktop()) return false;
      const activeLeafWriter = getDefaultStore().get(leafwriterAtom) ?? leafWriter;
      if (!activeLeafWriter) return false;
      if (isWriterReady()) return true;

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

      activeLeafWriter.init({
        document: {
          url: SETTINGS_BOOTSTRAP_URL,
          xml: stripTeiHeaderForVisualEditor(SETTINGS_BOOTSTRAP_XML),
        },
        settings,
        user: author,
      });

      if (!activeLeafWriter.onLoad.observed) {
        setEditorEvents();
      }

      return waitForWriter();
    });
  };

  /** Load a different project file into an already-running editor (tab switch / second file). */
  const loadDocumentInWriter = async (
    filePath: string,
    content: string,
    cursorPosition?: WorkspaceCursorPosition | null,
    restoreDirty = false,
    shouldApply?: () => boolean,
  ): Promise<boolean> => {
    if (!isWriterReady()) {
      const ready = await waitForWriter();
      if (!ready) return false;
    }

    if (!window.writer) return false;

    if (isDesktop() && rootPath && config?.schema) {
      const prepared = await prepareProjectDocument(filePath, content);
      content = prepared.content;
      registerDesktopSchemas([
        ...getEnabledCatalogSchemas(),
        ...projectSchemas,
        ...prepared.schemas,
      ]);
    }

    if (shouldApply && !shouldApply()) return false;

    if (isDesktop()) {
      window.__desktopStoredDocumentXml = content;
    }

    if (shouldOpenTeiInSourceMode(content, filePath)) {
      window.writer.overmindActions?.document?.setDocumentUrl?.(filePath);
      window.writer.overmindActions?.ui?.openDocumentInSourceMode?.({ content, filePath });
      const applyDirty = () => {
        window.writer?.overmindActions?.editor?.setContentHasChanged?.(restoreDirty);
        window.writer?.overmindActions?.project?.markTabDirty?.(restoreDirty);
      };
      applyDirty();
      queueMicrotask(applyDirty);
      window.writer.layoutManager?.resizeEditor?.();
      window.writer.layoutManager?.resizeAll?.();
      showDefaultEastPanel();
      return true;
    }

    window.writer.overmindActions?.ui?.resetSourceEditor?.();
    window.writer.overmindActions?.document?.setDocumentUrl?.(filePath);
    window.writer.loadDocumentXML(content);
    // loadDocumentXML / documentLoaded clear dirty — restore the tab's own flag.
    const applyDirty = () => {
      window.writer?.overmindActions?.editor?.setContentHasChanged?.(restoreDirty);
      window.writer?.overmindActions?.project?.markTabDirty?.(restoreDirty);
      if (window.writer?.editor) window.writer.editor.isNotDirty = !restoreDirty;
    };
    applyDirty();
    queueMicrotask(applyDirty);
    window.writer.layoutManager?.resizeEditor?.();
    window.writer.layoutManager?.resizeAll?.();
    if (cursorPosition) {
      restoreCursorPositionWhenReady(cursorPosition);
    } else {
      focusFirstBodyParagraph();
    }
    showDefaultEastPanel();
    return true;
  };

  const setEditorEvents = () => {
    if (!leafWriter) return;

    if (leafWriter.onLoad.observed) removeSubscribers();

    const dirtyEvent = leafWriter.onContentHasChanged.subscribe((value) => {
      if (!leafWriter) return;
      setContentHasChanged(value);
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
      if (isDesktop()) {
        const editor = leafWriter;
        removeSubscribers();
        if (tapDocumentTimer) clearTimeout(tapDocumentTimer);

        void (async () => {
          editor.dispose();
          setLeafWriter(null);
          resetLibLoaded();
          bumpEditorSession((key) => key + 1);
          notifyViaSnackbar({
            message: t('LWC.messages.could_not_open_document'),
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
  };

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

    if (action === 'saveAs') {
      saveAs({ content });
      return;
    }

    const saved = await save({ content });

    if (!saved.success) {
      notifyViaSnackbar({
        message: `${saved.error.message}. ${t('LWC.storage.document_not_saved')}!`,
        options: { variant: saved.error.type },
      });
      return;
    }

    leafWriter.setContentHasChanged(false);

    if (saved.saved) {
      notifyViaSnackbar({
        message: t('LWC.storage.document_saved'),
        options: { variant: 'success' },
      });
    }
  };

  const saveFeedback = (saved: boolean) => {
    if (saved) {
      notifyViaSnackbar({
        message: t('LWC.storage.document_saved'),
        options: { variant: 'success' },
      });
      leafWriter?.setContentHasChanged(false);
      return;
    }

    notifyViaSnackbar({
      message: `${t('LWC.error.something_went_wrong')}. ${t('LWC.storage.document_not_saved')}!`,
      options: { variant: 'error' },
    });
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

        setContentLastSaved(content);
        addToRecentDocument({ ...resource, schemaName });
      }, 5_000),
    );
  };

  const disposeLeafWriter = () => {
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
