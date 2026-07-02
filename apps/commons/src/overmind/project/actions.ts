import type { Context } from '../';
import { buildProjectSchemas, joinProjectPath, type ProjectBundle } from '@src/desktop/projectFile';
import { completeProjectOnboarding } from '@src/desktop/projectOnboarding';
import {
  mergeMetadataIntoHeader,
  metadataFileExists,
  readProjectMetadata,
} from '@src/desktop/projectMetadata';
import { getDefaultSaveAsPath as buildDefaultSaveAsPath } from '@src/desktop/saveAsDefaults';
import {
  getParentPath,
  getPathBasename,
  getProjectSchemaDirPath,
  joinPath,
  removeTreeNode,
  repathFilePath,
  repathTreeSubtree,
  shouldHideExplorerDirectoryEntry,
  updateTreeNode,
} from '@src/desktop/explorer/treeUtils';
import { prepareDesktopDocument } from '@src/desktop/resolveDocumentSchemas';
import { normalizeTeiHeaderLanguageElements } from '@src/desktop/teiHeaderXml';
import { updateTagStatsForFile } from '@src/desktop/tagging/tagStats';
import {
  findCompanionTranslationFiles,
  rewriteCompanionSourceReferences,
} from '@src/desktop/translationCompanionOps';
import { translationFilePathFor } from '@src/desktop/translationFileNaming';
import { reindexTranslationOnSave } from '@src/desktop/translationEntry';
import { clearWriterSession, resetDesktopEditorSession } from '@src/desktop/clearWriterSession';
import {
  DESKTOP_LEFT_PANEL_EVENT,
  type DesktopLeftPanelShowDetail,
} from '@src/desktop/desktopLeftPanelBridge';
import { registerDesktopSchemas } from '@src/desktop/registerDesktopSchemas';
import { getEnabledCatalogSchemas } from '@src/desktop/schemaCatalog';
import { warmMetadataDialogStateCache } from '@src/desktop/projectMetadataDialogState';
import { maybeCheckSchemaUpdateOnOpen } from '@src/desktop/schemaUpdateCheck';
import { stampContentBeforeSave } from '@src/desktop/revisionDescXml';
import { separateBlockElements } from '@src/desktop/xmlBlockSpacing';
import {
  mergeEditorBodyWithStoredHeader,
  stripTeiHeaderForVisualEditor,
} from '@src/desktop/teiHeaderXml';
import { isDesktop } from '@src/types/desktop';
import { buildSkeletonForCatalog } from '@src/desktop/schemaTemplates';
import type { FileTreeNode } from './state';

const getFilename = (filePath: string) => filePath.split(/[/\\]/).pop() ?? filePath;

const isTempDocumentPath = (filePath: string): boolean =>
  /[/\\]le-jean-baptiste[/\\]/.test(filePath);

const isTempTab = (tab: { filePath: string; isTemp?: boolean }) =>
  tab.isTemp || isTempDocumentPath(tab.filePath);

export const deleteTempDocumentAt = async (filePath: string): Promise<void> => {
  if (!isTempDocumentPath(filePath) || !window.electronAPI?.deletePath) return;
  const tempDir = getParentPath(filePath);
  if (!tempDir) return;
  try {
    await window.electronAPI.deletePath(tempDir);
  } catch {
    // temp dir may already be gone
  }
};

export type PromptCloseDirtyTabResult = 'proceed' | 'abort' | 'handled';

export const promptCloseDirtyTab = async (
  context: Context,
  payload: {
    tab: { filePath: string; filename: string; content: string; isTemp?: boolean };
    contentOverride?: string | null;
  },
): Promise<PromptCloseDirtyTabResult> => {
  const { tab, contentOverride } = payload;
  if (!window.electronAPI?.showNativeMessageBox) return 'proceed';

  if (isTempTab(tab)) {
    const response = await window.electronAPI.showNativeMessageBox({
      type: 'warning',
      title: 'Unsaved new document',
      message: `Save "${tab.filename}" to your project folder before closing?`,
      buttons: ['Save…', "Don't Save", 'Cancel'],
      cancelId: 2,
      defaultId: 0,
    });

    if (response.response === 2) return 'abort';
    if (response.response === 1) {
      await deleteTempDocumentAt(tab.filePath);
      return 'proceed';
    }

    const content =
      contentOverride ??
      (await getActiveEditorContent()) ??
      tab.content ??
      context.state.editor.resource?.content ??
      null;

    if (!content) {
      context.actions.ui.notifyViaSnackbar('Could not read document content.');
      return 'abort';
    }

    const saveResult = await saveActiveTabAs(context, { content });
    if (!saveResult.success) return 'abort';

    const savedPath = context.state.project.activeTabPath;
    if (savedPath) {
      await closeTab(context, { content, filePath: savedPath });
    }
    return 'handled';
  }

  const response = await window.electronAPI.showNativeMessageBox({
    type: 'warning',
    title: 'Unsaved changes',
    message: `${tab.filename} has unsaved changes. Close without saving?`,
    buttons: ['Discard changes', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
  });

  if (response.response !== 0) return 'abort';
  return 'proceed';
};

const isSourceEditorMode = () => window.writer?.overmindState?.ui?.editorViewMode === 'source';

const ignoreSavedFileChange = async (filePath: string) => {
  if (!window.electronAPI?.statFile || !window.electronAPI?.ignoreFileChange) return;

  try {
    const { mtimeMs } = await window.electronAPI.statFile(filePath);
    await window.electronAPI.ignoreFileChange(filePath, mtimeMs);
  } catch {
    // ignore
  }
};

const pushContentToEditor = (content: string, options?: { resetUndo?: boolean }) => {
  if (!window.writer) return;

  if (isSourceEditorMode()) {
    if (options?.resetUndo) window.__leafWriterNextSourceSyncResetsUndo = true;
    window.writer.overmindActions?.ui?.markSourceSaved?.(content);
    window.writer.overmindActions?.ui?.setSourceCurrentContent?.(content);
    return;
  }

  // Visual mode needs no flag: loadDocumentXML already clears the undo stack on documentLoaded.
  window.writer.loadDocumentXML(content);
};

const getExplorerSchemaDirPath = (rootPath: string | null, schema?: { rng?: string } | null) =>
  rootPath ? getProjectSchemaDirPath(rootPath, schema) : null;

const loadTreeLevel = async (
  dirPath: string,
  schemaDirPath: string | null = null,
): Promise<FileTreeNode[]> => {
  if (!window.electronAPI) return [];
  const entries = await window.electronAPI.readDirectory(dirPath);
  return entries
    .filter((entry) => !shouldHideExplorerDirectoryEntry(entry.path, schemaDirPath))
    .map((entry) => ({
      ...entry,
      children: entry.isDirectory ? [] : undefined,
      childrenLoaded: !entry.isDirectory,
    }));
};

const invokeOpenProjectDialog = async (): Promise<ProjectBundle | null> => {
  const api = window.electronAPI;
  if (!api) return null;
  if (api.openProject) return api.openProject();
  // Backward compat with older preload builds.
  const legacy = api as typeof api & {
    openProjectFolder?: () => Promise<ProjectBundle | null>;
  };
  if (legacy.openProjectFolder) return legacy.openProjectFolder();
  return null;
};

const getActiveEditorContent = async (): Promise<string | null> => {
  if (window.writer?.getContent) {
    const content = await window.writer.getContent();
    if (!content) return null;

    if (isDesktop() && !isSourceEditorMode()) {
      const baseXml =
        window.__desktopStoredDocumentXml ?? window.writer.overmindState?.document?.xml ?? content;
      return mergeEditorBodyWithStoredHeader(stripTeiHeaderForVisualEditor(content), baseXml);
    }

    return content;
  }
  return null;
};

const promptUnsavedBeforeProjectSwitch = async (context: Context): Promise<'proceed' | 'abort'> => {
  if (!window.electronAPI?.showNativeMessageBox) return 'proceed';

  const dirtyTabs = context.state.project.openTabs.filter((tab) => tab.dirty);
  if (dirtyTabs.length === 0) return 'proceed';

  const tempDirtyTabs = dirtyTabs.filter(isTempTab);
  const persistentDirtyTabs = dirtyTabs.filter((tab) => !isTempTab(tab));

  if (persistentDirtyTabs.length === 0 && tempDirtyTabs.length > 0) {
    const response = await window.electronAPI.showNativeMessageBox({
      type: 'warning',
      title: 'Unsaved new document',
      message: 'Save the new document to your project folder before opening another project?',
      buttons: ['Save…', "Don't Save", 'Cancel'],
      cancelId: 2,
      defaultId: 0,
    });

    if (response.response === 2) return 'abort';
    if (response.response === 1) return 'proceed';

    const activePath = context.state.project.activeTabPath;
    const tempTab = tempDirtyTabs.find((tab) => tab.filePath === activePath) ?? tempDirtyTabs[0];
    const content =
      (await getActiveEditorContent()) ??
      tempTab.content ??
      context.state.editor.resource?.content ??
      null;

    if (!content) {
      context.actions.ui.notifyViaSnackbar('Open an XML file before saving.');
      return 'abort';
    }

    const saveResult = await saveActiveTabAs(context, { content });
    if (!saveResult.success) return 'abort';
    return 'proceed';
  }

  const fileList = persistentDirtyTabs.map((tab) => tab.filename).join('\n');
  const response = await window.electronAPI.showNativeMessageBox({
    type: 'warning',
    title: 'Unsaved documents',
    message: `Save changes before opening another project?\n\n${fileList}`,
    buttons: ['Save All', "Don't Save", 'Cancel'],
    cancelId: 2,
    defaultId: 0,
  });

  if (response.response === 2) return 'abort';
  if (response.response === 0) {
    const saveResult = await saveAllDirtyTabs(context);
    if (!saveResult.ok) {
      context.actions.ui.notifyViaSnackbar(saveResult.error ?? 'Could not save all files.');
      return 'abort';
    }
  }

  return 'proceed';
};

export const saveAllDirtyTabs = async (
  context: Context,
): Promise<{ ok: boolean; error?: string }> => {
  const { state } = context;
  if (!window.electronAPI) return { ok: false, error: 'Desktop file access unavailable.' };

  const activePath = state.project.activeTabPath;
  let activeContent: string | null = null;

  if (
    activePath &&
    state.project.openTabs.some((tab) => tab.filePath === activePath && tab.dirty)
  ) {
    activeContent = await getActiveEditorContent();
    if (!activeContent) {
      activeContent =
        state.project.openTabs.find((tab) => tab.filePath === activePath)?.content ?? null;
    }
  }

  for (const tab of state.project.openTabs) {
    if (!tab.dirty) continue;

    if (isTempTab(tab)) {
      return {
        ok: false,
        error: 'Save new documents to the project folder before switching projects.',
      };
    }

    const content = tab.filePath === activePath && activeContent ? activeContent : tab.content;

    try {
      await window.electronAPI.writeFile(tab.filePath, content);
      await ignoreSavedFileChange(tab.filePath);
    } catch {
      return { ok: false, error: `Could not save ${tab.filename}.` };
    }
  }

  state.project.openTabs = state.project.openTabs.map((tab) => {
    if (!tab.dirty) return tab;
    const content = tab.filePath === activePath && activeContent ? activeContent : tab.content;
    return { ...tab, content, dirty: false };
  });

  if (activePath && activeContent) {
    state.editor.contentLastSaved = activeContent;
    state.editor.contentHasChanged = false;
  }

  return { ok: true };
};

const showExplorerLeftPanel = () => {
  window.__desktopLeftPanel?.showTab('explorer');
  window.dispatchEvent(
    new CustomEvent<DesktopLeftPanelShowDetail>(DESKTOP_LEFT_PANEL_EVENT, {
      detail: { tab: 'explorer' },
    }),
  );
};

const captureActiveCursorPosition = (state: Context['state']['project']) => {
  const activePath = state.activeTabPath;
  if (!activePath) {
    console.info('[cursor-session] capture skipped: no active tab');
    return;
  }

  const cursorPosition = window.__leafWriterCursorSession?.capture();
  console.info('[cursor-session] capture active tab', {
    filePath: activePath,
    hasBridge: Boolean(window.__leafWriterCursorSession),
    cursorPosition,
  });
  if (cursorPosition) {
    state.cursorPositions = {
      ...state.cursorPositions,
      [activePath]: cursorPosition,
    };
  }
};

const loadProjectBundle = async (context: Context, bundle: ProjectBundle) => {
  const { state, actions } = context;
  state.project.rootPath = bundle.rootPath;
  state.project.projectFilePath = bundle.projectFilePath;
  state.project.config = bundle.config;
  state.project.projectSchemas = buildProjectSchemas(bundle.rootPath, bundle.config);
  state.project.tree = await loadTreeLevel(
    bundle.rootPath,
    getExplorerSchemaDirPath(bundle.rootPath, bundle.config?.schema),
  );
  state.project.isProjectReady = true;
  state.project.explorerFocusedPath = null;
  state.project.explorerFocusedIsDirectory = false;

  if (window.writer) {
    window.writer.overmindActions?.editor?.clearProjectSchemas?.();
    registerDesktopSchemas([...getEnabledCatalogSchemas(), ...state.project.projectSchemas]);
  }

  if (isDesktop()) {
    void warmMetadataDialogStateCache(bundle, 'edition');
    void maybeCheckSchemaUpdateOnOpen(bundle.projectFilePath, {
      notify: (message) => actions.ui.notifyViaSnackbar(message),
      onBundleUpdated: (updatedBundle) => {
        state.project.config = updatedBundle.config;
        state.project.projectSchemas = buildProjectSchemas(
          updatedBundle.rootPath,
          updatedBundle.config,
        );
        if (window.writer) {
          registerDesktopSchemas([...getEnabledCatalogSchemas(), ...state.project.projectSchemas]);
        }
      },
    });
  }

  showExplorerLeftPanel();
};

export const openProject = async (context: Context) => {
  const { notifyViaSnackbar } = context.actions.ui;

  if (!window.electronAPI) {
    notifyViaSnackbar('Desktop file access is unavailable. Restart the desktop app.');
    return;
  }

  try {
    if (context.state.project.rootPath) {
      const guard = await promptUnsavedBeforeProjectSwitch(context);
      if (guard === 'abort') return;
    }

    const bundle = await invokeOpenProjectDialog();
    if (!bundle) return;

    const onboarded = await completeProjectOnboarding(bundle);
    if (!onboarded) return;

    context.state.project.openTabs = [];
    context.state.project.activeTabPath = null;
    context.state.project.cursorPositions = {};
    context.state.editor.contentHasChanged = false;
    context.state.editor.contentLastSaved = undefined;
    window.writer?.overmindActions?.ui?.resetSourceEditor?.();
    await context.actions.editor.clearResource();
    resetDesktopEditorSession();
    await loadProjectBundle(context, onboarded);
  } catch (error) {
    console.error('[project] openProject failed:', error);
    notifyViaSnackbar('Could not open the project folder. Check the console for details.');
    context.state.project.isProjectReady = true;
  }
};

export const restoreLastProject = async (context: Context) => {
  if (!window.electronAPI?.restoreWorkspaceSession && !window.electronAPI?.restoreLastProject) {
    context.state.project.isProjectReady = true;
    return;
  }

  if (context.state.project.rootPath) {
    context.state.project.isProjectReady = true;
    return;
  }

  try {
    const session = await window.electronAPI.restoreWorkspaceSession?.();
    const bundle = session?.bundle ?? (await window.electronAPI.restoreLastProject?.());
    if (!bundle) {
      context.state.project.isProjectReady = true;
      return;
    }

    const onboarded = await completeProjectOnboarding(bundle);
    if (!onboarded) {
      context.state.project.isProjectReady = true;
      return;
    }

    await loadProjectBundle(context, onboarded);
    context.state.project.cursorPositions = session?.cursorPositions ?? {};
    console.info('[cursor-session] hydrated startup cursor positions', {
      activeFilePath: session?.activeFilePath,
      files: Object.keys(context.state.project.cursorPositions),
    });

    const openFilePaths = session?.openFilePaths ?? [];
    for (const filePath of openFilePaths) {
      try {
        await context.actions.project.openFile(filePath);
      } catch (error) {
        console.warn('[project] restoreWorkspaceSession skipped file:', filePath, error);
      }
    }

    if (session?.activeFilePath && context.state.project.activeTabPath !== session.activeFilePath) {
      await context.actions.project.switchTab({ filePath: session.activeFilePath });
    }

    const activePath = context.state.project.activeTabPath;
    const cursorPosition = activePath ? session?.cursorPositions?.[activePath] : null;
    console.info('[cursor-session] startup active cursor lookup', {
      activePath,
      cursorPosition,
    });
  } catch (error) {
    console.error('[project] restoreLastProject failed:', error);
    context.state.project.isProjectReady = true;
  }
};

/** @deprecated Use openProject */
export const openProjectFolder = openProject;

export const saveWorkspaceSession = async ({ state }: Context) => {
  if (!window.electronAPI?.saveWorkspaceSession || !state.project.projectFilePath) return;

  const openFilePaths = state.project.openTabs
    .filter((tab) => !isTempTab(tab))
    .map((tab) => tab.filePath);
  const activeCursorPosition =
    state.project.activeTabPath && openFilePaths.includes(state.project.activeTabPath)
      ? (window.__leafWriterCursorSession?.capture() ?? null)
      : null;
  const cursorPositions =
    activeCursorPosition && state.project.activeTabPath
      ? { ...state.project.cursorPositions, [state.project.activeTabPath]: activeCursorPosition }
      : state.project.cursorPositions;

  try {
    await window.electronAPI.saveWorkspaceSession({
      activeFilePath:
        state.project.activeTabPath && openFilePaths.includes(state.project.activeTabPath)
          ? state.project.activeTabPath
          : null,
      cursorPositions,
      openFilePaths,
      projectFilePath: state.project.projectFilePath,
    });
  } catch (error) {
    console.warn('[project] saveWorkspaceSession failed:', error);
  }
};

export const newFile = async (context: Context) => {
  const { notifyViaSnackbar } = context.actions.ui;
  const { state, actions } = context;

  if (!window.electronAPI?.createTempDocument) {
    notifyViaSnackbar('New File is unavailable. Restart the desktop app.');
    return;
  }

  if (!state.project.isProjectReady || !state.project.rootPath || !state.project.config) {
    notifyViaSnackbar('Open a project first.');
    void actions.project.openProject();
    return;
  }

  if (!state.project.projectFilePath) {
    notifyViaSnackbar('Project is not fully loaded.');
    return;
  }

  const bundle: ProjectBundle = {
    rootPath: state.project.rootPath,
    projectFilePath: state.project.projectFilePath,
    config: state.project.config,
  };

  if (!(await metadataFileExists(bundle))) {
    notifyViaSnackbar('Complete project metadata setup before creating a file.');
    return;
  }

  let content = buildSkeletonForCatalog(state.project.config);
  const metadata = await readProjectMetadata(bundle);
  if (metadata) {
    content = mergeMetadataIntoHeader(content, metadata);
  }

  try {
    const temp = await window.electronAPI.createTempDocument(content);
    const prepared = await prepareDesktopDocument(
      temp.filePath,
      content,
      state.project.rootPath,
      state.project.config?.schema,
    );
    content = prepared.content;
    registerDesktopSchemas([...state.project.projectSchemas, ...prepared.schemas]);

    const tab = {
      content,
      dirty: false,
      editorReady: true,
      filePath: temp.filePath,
      filename: temp.filename,
      isTemp: true,
    };

    state.project.openTabs = [...state.project.openTabs, tab];
    state.project.activeTabPath = temp.filePath;

    await actions.editor.setResource({
      content,
      filePath: temp.filePath,
      filename: temp.filename,
      isLocal: true,
    });
    state.editor.contentLastSaved = content;
  } catch (error) {
    console.error('[project] newFile failed:', error);
    notifyViaSnackbar('Could not create a new file.');
  }
};

export const loadDirectoryChildren = async ({ state }: Context, dirPath: string) => {
  const schemaDirPath = getExplorerSchemaDirPath(
    state.project.rootPath,
    state.project.config?.schema,
  );
  const updateTree = async (nodes: FileTreeNode[]): Promise<FileTreeNode[]> => {
    return Promise.all(
      nodes.map(async (node) => {
        if (node.path === dirPath && node.isDirectory && !node.childrenLoaded) {
          const children = await loadTreeLevel(dirPath, schemaDirPath);
          return { ...node, children, childrenLoaded: true };
        }
        if (node.children) {
          return { ...node, children: await updateTree(node.children) };
        }
        return node;
      }),
    );
  };

  state.project.tree = await updateTree(state.project.tree);
};

const prepareFileContent = async ({ state }: Context, filePath: string, content: string) => {
  if (!window.electronAPI || !state.project.rootPath || !state.project.isProjectReady) {
    return content;
  }

  const prepared = await prepareDesktopDocument(
    filePath,
    content,
    state.project.rootPath,
    state.project.config?.schema,
  );

  registerDesktopSchemas([...state.project.projectSchemas, ...prepared.schemas]);

  return normalizeTeiHeaderLanguageElements(prepared.content);
};

export const openFile = async ({ state, actions }: Context, filePath: string) => {
  if (!window.electronAPI || !state.project.isProjectReady || !state.project.rootPath) return;
  const existing = state.project.openTabs.find((tab) => tab.filePath === filePath);
  if (existing) {
    await actions.project.switchTab({ filePath });
    return;
  }

  try {
    let content = await window.electronAPI.readFile(filePath);
    content = await prepareFileContent({ state, actions } as Context, filePath, content);
    const filename = getFilename(filePath);
    const tab = { content, dirty: false, editorReady: true, filePath, filename };

    state.project.openTabs = [...state.project.openTabs, tab];
    state.project.activeTabPath = filePath;

    await actions.editor.setResource({
      content,
      filePath,
      filename,
      isLocal: true,
    });
    state.editor.contentLastSaved = content;

    const cursorPosition = state.project.cursorPositions[filePath];
    console.info('[cursor-session] open file cursor lookup', {
      filePath,
      cursorPosition,
      knownFiles: Object.keys(state.project.cursorPositions),
    });
  } catch (error) {
    throw error;
  }
};

export const switchTab = async (
  { state, actions }: Context,
  { content, filePath }: { content?: string; filePath: string },
) => {
  console.info('[cursor-session] switch tab requested', {
    from: state.project.activeTabPath,
    to: filePath,
  });
  captureActiveCursorPosition(state.project);

  if (content && state.project.activeTabPath) {
    const currentTab = state.project.openTabs.find(
      (tab) => tab.filePath === state.project.activeTabPath,
    );
    if (currentTab) {
      let savedContent = content;
      if (window.electronAPI) {
        savedContent = await prepareFileContent(
          { state, actions } as Context,
          currentTab.filePath,
          content,
        );
      }
      currentTab.content = savedContent;
      currentTab.dirty = savedContent !== state.editor.contentLastSaved;
      currentTab.editorReady = true;
    }
  }

  const tab = state.project.openTabs.find((item) => item.filePath === filePath);
  if (!tab) return;

  if (!tab.editorReady) {
    tab.content = await prepareFileContent(
      { state, actions } as Context,
      tab.filePath,
      tab.content,
    );
    tab.editorReady = true;
  }

  state.project.activeTabPath = filePath;
  state.editor.contentHasChanged = tab.dirty;

  await actions.editor.setResource({
    content: tab.content,
    filePath: tab.filePath,
    filename: tab.filename,
    isLocal: true,
  });
  state.editor.contentLastSaved = tab.content;
};

export const saveActiveTab = async (
  context: Context,
  { content }: { content: string },
): Promise<{ success: boolean; content?: string; error?: string }> => {
  const { state } = context;
  if (!window.electronAPI || !state.project.activeTabPath) {
    return { success: false, error: 'No active file' };
  }

  const filePath = state.project.activeTabPath;
  const tab = state.project.openTabs.find((item) => item.filePath === filePath);
  if (tab && isTempTab(tab)) {
    return saveActiveTabAs(context, { content });
  }

  try {
    const baseXml = window.__desktopStoredDocumentXml ?? tab?.content ?? content;
    const editorBody = stripTeiHeaderForVisualEditor(content);
    const merged = mergeEditorBodyWithStoredHeader(editorBody, baseXml);
    const stamped = separateBlockElements(
      await stampContentBeforeSave(merged, state.project.config?.schema?.catalogId),
    );
    await window.electronAPI.writeFile(filePath, stamped);
    if (state.project.rootPath) {
      void updateTagStatsForFile(state.project.rootPath, filePath, stamped);
    }
    state.project.openTabs = state.project.openTabs.map((tab) =>
      tab.filePath === filePath ? { ...tab, content: stamped, dirty: false } : tab,
    );
    state.editor.contentLastSaved = stamped;
    state.editor.contentHasChanged = false;
    window.__desktopStoredDocumentXml = stamped;
    window.writer?.overmindActions?.document?.setDocumentXml?.(stamped);
    await ignoreSavedFileChange(filePath);

    const reindexed = await reindexTranslationOnSave(filePath, stamped);
    if (reindexed) {
      await context.actions.project.reloadTabFromDisk(filePath);
      return { success: true, content: reindexed };
    }

    return { success: true, content: stamped };
  } catch {
    return { success: false, error: 'Failed to save file' };
  }
};

export const setExternalChangePending = (
  { state }: Context,
  { filePath, pending }: { filePath: string; pending: boolean },
) => {
  state.project.openTabs = state.project.openTabs.map((tab) =>
    tab.filePath === filePath ? { ...tab, externalChangePending: pending } : tab,
  );
};

export const reloadTabFromDisk = async ({ state, actions }: Context, filePath: string) => {
  if (!window.electronAPI || !state.project.isProjectReady) return false;

  const tab = state.project.openTabs.find((item) => item.filePath === filePath);
  if (!tab) return false;

  try {
    let content = await window.electronAPI.readFile(filePath);
    content = await prepareFileContent({ state, actions } as Context, filePath, content);

    state.project.openTabs = state.project.openTabs.map((item) =>
      item.filePath === filePath
        ? { ...item, content, dirty: false, externalChangePending: false }
        : item,
    );

    if (state.project.activeTabPath === filePath) {
      state.editor.contentHasChanged = false;
      state.editor.contentLastSaved = content;

      await actions.editor.setResource({
        content,
        filePath,
        filename: tab.filename,
        isLocal: true,
      });

      pushContentToEditor(content, { resetUndo: true });
    }

    await ignoreSavedFileChange(filePath);
    return true;
  } catch {
    return false;
  }
};

/** Save As default: explorer focus, else project root (never app temp dir). */
const getDefaultSaveAsPath = (
  state: Context['state']['project'],
  previousPath?: string,
): string | undefined => {
  const tab = previousPath
    ? state.openTabs.find((item) => item.filePath === previousPath)
    : undefined;
  const filename = tab?.filename ?? (previousPath ? getFilename(previousPath) : 'untitled.xml');
  const isTempFile = Boolean(tab?.isTemp || (previousPath && isTempDocumentPath(previousPath)));

  return buildDefaultSaveAsPath({
    rootPath: state.rootPath,
    explorerFocusedPath: state.explorerFocusedPath,
    explorerFocusedIsDirectory: state.explorerFocusedIsDirectory,
    filename,
    previousPath,
    isTempFile,
  });
};

export const setExplorerFocusedPath = (
  { state }: Context,
  payload: { path: string; isDirectory: boolean },
) => {
  if (!state.project.rootPath || !payload.path.startsWith(state.project.rootPath)) return;
  state.project.explorerFocusedPath = payload.path;
  state.project.explorerFocusedIsDirectory = payload.isDirectory;
};

export const saveActiveTabAs = async (
  { state, actions }: Context,
  { content }: { content: string },
): Promise<{ success: boolean; cancelled?: boolean; content?: string; error?: string }> => {
  if (!window.electronAPI) {
    return { success: false, error: 'Save is only available in the desktop app' };
  }

  if (typeof window.electronAPI.saveFileAs !== 'function') {
    return {
      success: false,
      error: 'Save As is unavailable. Quit and restart the desktop app.',
    };
  }

  const previousPath = state.project.activeTabPath ?? undefined;
  const defaultSavePath = getDefaultSaveAsPath(state.project, previousPath);
  let filePath: string | null;
  try {
    filePath = await window.electronAPI.saveFileAs(defaultSavePath);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Save As failed',
    };
  }

  if (!filePath) {
    return { success: false, cancelled: true };
  }

  try {
    const sourceTab = previousPath
      ? state.project.openTabs.find((item) => item.filePath === previousPath)
      : state.project.openTabs.find((item) => item.filePath === state.project.activeTabPath);
    const baseXml = window.__desktopStoredDocumentXml ?? sourceTab?.content ?? content;
    const editorBody = stripTeiHeaderForVisualEditor(content);
    const merged = mergeEditorBodyWithStoredHeader(editorBody, baseXml);
    const stamped = separateBlockElements(
      await stampContentBeforeSave(merged, state.project.config?.schema?.catalogId),
    );
    await window.electronAPI.writeFile(filePath, stamped);
    const filename = getFilename(filePath);

    if (previousPath) {
      state.project.openTabs = state.project.openTabs.map((tab) =>
        tab.filePath === previousPath
          ? { ...tab, filePath, filename, content: stamped, dirty: false, isTemp: false }
          : tab,
      );
      state.project.activeTabPath = filePath;
    } else {
      state.project.openTabs = [
        ...state.project.openTabs,
        {
          content: stamped,
          dirty: false,
          editorReady: true,
          filePath,
          filename,
          isTemp: false,
        },
      ];
      state.project.activeTabPath = filePath;
    }

    await actions.editor.setResource({
      content: stamped,
      filePath,
      filename,
      isLocal: true,
    });

    state.editor.contentLastSaved = stamped;
    state.editor.contentHasChanged = false;
    window.__desktopStoredDocumentXml = stamped;
    window.writer?.overmindActions?.document?.setDocumentXml?.(stamped);
    await ignoreSavedFileChange(filePath);
    if (state.project.rootPath) {
      await reloadDirectoryInTree({ state } as Context, getParentPath(filePath));
    }

    const reindexed = await reindexTranslationOnSave(filePath, stamped);
    if (reindexed) {
      await actions.project.reloadTabFromDisk(filePath);
      return { success: true, content: reindexed };
    }

    return { success: true, content: stamped };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save file',
    };
  }
};

export const isTabContentStaleOnDisk = async (
  { state, actions }: Context,
  filePath: string,
): Promise<boolean> => {
  const tab = state.project.openTabs.find((item) => item.filePath === filePath);
  if (!tab || !window.electronAPI) return false;

  try {
    let diskContent = await window.electronAPI.readFile(filePath);
    diskContent = await prepareFileContent({ state, actions } as Context, filePath, diskContent);

    let baseline = tab.content;
    const isSourceActive =
      state.project.activeTabPath === filePath &&
      window.writer?.overmindState?.ui?.editorViewMode === 'source';

    if (isSourceActive) {
      const sourceOriginal = window.writer?.overmindState?.ui?.sourceOriginalContent;
      if (sourceOriginal) {
        baseline = await prepareFileContent(
          { state, actions } as Context,
          filePath,
          sourceOriginal,
        );
      }
    }

    return diskContent !== baseline;
  } catch {
    return false;
  }
};

export const closeTab = async (
  { state, actions }: Context,
  { content, filePath }: { content?: string; filePath: string },
) => {
  console.info('[cursor-session] close tab requested', {
    activeTabPath: state.project.activeTabPath,
    filePath,
  });
  if (state.project.activeTabPath === filePath) {
    captureActiveCursorPosition(state.project);
  }

  if (content) {
    const tab = state.project.openTabs.find((item) => item.filePath === filePath);
    if (tab) tab.content = content;
  }

  const closingTab = state.project.openTabs.find((tab) => tab.filePath === filePath);
  if (closingTab && isTempTab(closingTab)) {
    await deleteTempDocumentAt(filePath);
  }

  const remaining = state.project.openTabs.filter((tab) => tab.filePath !== filePath);
  state.project.openTabs = remaining;

  if (state.project.activeTabPath !== filePath) return;

  if (remaining.length === 0) {
    state.project.activeTabPath = null;
    state.editor.contentHasChanged = false;
    state.editor.contentLastSaved = undefined;
    await actions.editor.clearResource();
    clearWriterSession();
    return;
  }

  const nextTab = remaining[remaining.length - 1];
  await actions.project.switchTab({ filePath: nextTab.filePath });
};

export const markTabDirty = ({ state }: Context, dirty: boolean) => {
  if (!state.project.activeTabPath) return;
  state.project.openTabs = state.project.openTabs.map((tab) =>
    tab.filePath === state.project.activeTabPath ? { ...tab, dirty } : tab,
  );
};

export const updateTabContent = (
  { state }: Context,
  { content, filePath }: { content: string; filePath: string },
) => {
  const tab = state.project.openTabs.find((item) => item.filePath === filePath);
  if (tab) tab.content = content;
  if (state.project.activeTabPath === filePath && state.editor.resource?.filePath === filePath) {
    state.editor.resource = { ...state.editor.resource, content };
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.__desktopStoredDocumentXml = content;
    }
  }
};

const treeContainsPath = (nodes: FileTreeNode[], targetPath: string): boolean =>
  nodes.some(
    (node) =>
      node.path === targetPath ||
      (node.children ? treeContainsPath(node.children, targetPath) : false),
  );

export const reloadDirectoryInTree = async ({ state }: Context, dirPath: string) => {
  const schemaDirPath = getExplorerSchemaDirPath(
    state.project.rootPath,
    state.project.config?.schema,
  );
  const children = await loadTreeLevel(dirPath, schemaDirPath);
  const isProjectRoot = Boolean(state.project.rootPath && dirPath === state.project.rootPath);
  const nodeFoundBefore = treeContainsPath(state.project.tree, dirPath);
  if (isProjectRoot) {
    state.project.tree = children;
    return;
  }

  state.project.tree = updateTreeNode(state.project.tree, dirPath, (node) => ({
    ...node,
    children,
    childrenLoaded: true,
  }));
};

const repathOpenTabsForMove = ({ state, actions }: Context, oldPath: string, newPath: string) => {
  let nextActiveTabPath = state.project.activeTabPath;

  state.project.openTabs = state.project.openTabs.map((tab) => {
    const repathed = repathFilePath(tab.filePath, oldPath, newPath);
    if (!repathed) return tab;
    return { ...tab, filePath: repathed, filename: getPathBasename(repathed) };
  });

  if (nextActiveTabPath) {
    const repathedActive = repathFilePath(nextActiveTabPath, oldPath, newPath);
    if (repathedActive) nextActiveTabPath = repathedActive;
  }

  state.project.activeTabPath = nextActiveTabPath;

  if (
    nextActiveTabPath &&
    state.editor.resource?.filePath &&
    repathFilePath(state.editor.resource.filePath, oldPath, newPath)
  ) {
    const tab = state.project.openTabs.find((item) => item.filePath === nextActiveTabPath);
    if (tab) {
      void actions.editor.setResource({
        content: tab.content,
        filePath: tab.filePath,
        filename: tab.filename,
        isLocal: true,
      });
    }
  }
};

export const createExplorerFolder = async (
  { state }: Context,
  { folderName, parentPath }: { folderName: string; parentPath: string },
): Promise<{ success: boolean; error?: string }> => {
  if (!window.electronAPI?.createDirectory) {
    return { success: false, error: 'Unavailable' };
  }

  const trimmed = folderName.trim();
  if (!trimmed || trimmed.includes('/') || trimmed.includes('\\')) {
    return { success: false, error: 'invalid_name' };
  }

  try {
    await window.electronAPI.createDirectory(parentPath, trimmed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create folder';
    if (message.includes('exists')) return { success: false, error: 'exists' };
    if (message.includes('Invalid')) return { success: false, error: 'invalid_name' };
    return { success: false, error: message };
  }

  await reloadDirectoryInTree({ state } as Context, parentPath);
  return { success: true };
};

export const renameExplorerItem = async (
  { state, actions }: Context,
  { oldPath, newName }: { oldPath: string; newName: string },
): Promise<{ success: boolean; error?: string }> => {
  if (!window.electronAPI?.renamePath || !state.project.rootPath) {
    return { success: false, error: 'Unavailable' };
  }

  const trimmed = newName.trim();
  if (!trimmed || trimmed.includes('/') || trimmed.includes('\\')) {
    return { success: false, error: 'invalid_name' };
  }

  const parentDir = getParentPath(oldPath);
  const newPath = joinPath(parentDir, trimmed);

  if (newPath === oldPath) return { success: true };

  // Resolve companions before the rename — their paths derive from the source filename.
  const companions = await findCompanionTranslationFiles(oldPath);

  try {
    await window.electronAPI.renamePath(oldPath, newPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to rename';
    if (message.includes('exists')) return { success: false, error: 'exists' };
    return { success: false, error: message };
  }

  for (const companion of companions) {
    try {
      const newCompanionPath = translationFilePathFor(newPath, companion.lang);
      // eslint-disable-next-line no-await-in-loop
      await window.electronAPI.renamePath(companion.path, newCompanionPath);

      // The companion's @corresp values still reference the old source filename — rewrite
      // them, or every unit lookup silently fails after the rename.
      // eslint-disable-next-line no-await-in-loop
      const companionXml = await window.electronAPI.readFile(newCompanionPath);
      const rewritten = rewriteCompanionSourceReferences(
        companionXml,
        getFilename(oldPath),
        getFilename(newPath),
      );
      if (rewritten && rewritten !== companionXml) {
        // eslint-disable-next-line no-await-in-loop
        await window.electronAPI.writeFile(newCompanionPath, rewritten);
      }
    } catch (error) {
      console.warn('[translation] failed to rename companion file', companion.path, error);
    }
  }

  state.project.tree = repathTreeSubtree(state.project.tree, oldPath, newPath);
  repathOpenTabsForMove({ state, actions } as Context, oldPath, newPath);
  await reloadDirectoryInTree({ state } as Context, parentDir);
  await ignoreSavedFileChange(newPath);
  return { success: true };
};

export const moveExplorerItem = async (
  { state, actions }: Context,
  { sourcePath, destDir }: { sourcePath: string; destDir: string },
): Promise<{ success: boolean; error?: string }> => {
  if (!window.electronAPI?.movePath) {
    return { success: false, error: 'Unavailable' };
  }

  const companions = await findCompanionTranslationFiles(sourcePath);

  try {
    const newPath = await window.electronAPI.movePath(sourcePath, destDir);
    const oldParent = getParentPath(sourcePath);

    for (const companion of companions) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await window.electronAPI.movePath(companion.path, destDir);
      } catch (error) {
        console.warn('[translation] failed to move companion file', companion.path, error);
      }
    }

    state.project.tree = removeTreeNode(state.project.tree, sourcePath);
    repathOpenTabsForMove({ state, actions } as Context, sourcePath, newPath);
    await reloadDirectoryInTree({ state } as Context, destDir);
    if (oldParent !== destDir) {
      await reloadDirectoryInTree({ state } as Context, oldParent);
    }
    await ignoreSavedFileChange(newPath);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to move';
    if (message.includes('itself')) return { success: false, error: 'into_self' };
    if (message.includes('exists')) return { success: false, error: 'exists' };
    return { success: false, error: message };
  }
};

export const deleteExplorerItem = async (
  { state, actions }: Context,
  targetPath: string,
): Promise<{ success: boolean; error?: string }> => {
  if (!window.electronAPI?.deletePath) {
    return { success: false, error: 'Unavailable' };
  }

  const parentDir = getParentPath(targetPath);
  const tabsToClose = state.project.openTabs.filter((tab) => {
    if (tab.filePath === targetPath) return true;
    const prefix = targetPath.endsWith('/') ? targetPath : `${targetPath}/`;
    return tab.filePath.startsWith(prefix);
  });

  const companions = await findCompanionTranslationFiles(targetPath);

  try {
    await window.electronAPI.deletePath(targetPath);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete',
    };
  }

  for (const companion of companions) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await window.electronAPI.deletePath(companion.path);
    } catch (error) {
      console.warn('[translation] failed to delete companion file', companion.path, error);
    }
  }

  state.project.tree = removeTreeNode(state.project.tree, targetPath);

  const pathsToClose = new Set(tabsToClose.map((tab) => tab.filePath));
  const remaining = state.project.openTabs.filter((tab) => !pathsToClose.has(tab.filePath));
  state.project.openTabs = remaining;

  if (state.project.activeTabPath && pathsToClose.has(state.project.activeTabPath)) {
    if (remaining.length === 0) {
      state.project.activeTabPath = null;
      window.writer?.overmindActions?.ui?.resetSourceEditor?.();
      await actions.editor.clearResource();
    } else {
      const nextTab = remaining[remaining.length - 1];
      await actions.project.switchTab({ filePath: nextTab.filePath });
    }
  }

  if (parentDir && parentDir !== '/') {
    await reloadDirectoryInTree({ state } as Context, parentDir);
  }

  return { success: true };
};

export const refreshProjectSchemaConfig = ({ state }: Context, bundle: ProjectBundle) => {
  state.project.config = bundle.config;
  state.project.projectSchemas = buildProjectSchemas(bundle.rootPath, bundle.config);

  if (window.writer) {
    window.writer.overmindActions?.editor?.clearProjectSchemas?.();
    registerDesktopSchemas([...getEnabledCatalogSchemas(), ...state.project.projectSchemas]);
  }
};
