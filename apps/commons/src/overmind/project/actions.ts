import type { Context } from '../';
import { buildProjectSchemas, type ProjectBundle } from '@src/desktop/projectFile';
import { prepareDesktopDocument } from '@src/desktop/resolveDocumentSchemas';
import { registerDesktopSchemas } from '@src/desktop/registerDesktopSchemas';
import type { FileTreeNode } from './state';

const getFilename = (filePath: string) => filePath.split(/[/\\]/).pop() ?? filePath;

const loadTreeLevel = async (dirPath: string): Promise<FileTreeNode[]> => {
  if (!window.electronAPI) return [];
  const entries = await window.electronAPI.readDirectory(dirPath);
  return entries.map((entry) => ({
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

const loadProjectBundle = async ({ state }: Context, bundle: ProjectBundle) => {
  state.project.rootPath = bundle.rootPath;
  state.project.projectFilePath = bundle.projectFilePath;
  state.project.config = bundle.config;
  state.project.projectSchemas = buildProjectSchemas(bundle.rootPath, bundle.config);
  state.project.tree = await loadTreeLevel(bundle.rootPath);
  state.project.isProjectReady = true;

  if (window.writer) {
    registerDesktopSchemas(state.project.projectSchemas);
  }
};

export const openProject = async (context: Context) => {
  const { notifyViaSnackbar } = context.actions.ui;

  if (!window.electronAPI) {
    notifyViaSnackbar('Desktop file access is unavailable. Restart the desktop app.');
    return;
  }

  try {
    const bundle = await invokeOpenProjectDialog();
    if (!bundle) return;

    context.state.project.openTabs = [];
    context.state.project.activeTabPath = null;
    await context.actions.editor.clearResource();
    await loadProjectBundle(context, bundle);
  } catch (error) {
    console.error('[project] openProject failed:', error);
    notifyViaSnackbar('Could not open the project folder. Check the console for details.');
    context.state.project.isProjectReady = true;
  }
};

export const restoreLastProject = async (context: Context) => {
  if (!window.electronAPI?.restoreLastProject) {
    context.state.project.isProjectReady = true;
    return;
  }

  if (context.state.project.rootPath) {
    context.state.project.isProjectReady = true;
    return;
  }

  try {
    const bundle = await window.electronAPI.restoreLastProject();
    if (!bundle) {
      context.state.project.isProjectReady = true;
      return;
    }

    await loadProjectBundle(context, bundle);
  } catch (error) {
    console.error('[project] restoreLastProject failed:', error);
    context.state.project.isProjectReady = true;
  }
};

/** @deprecated Use openProject */
export const openProjectFolder = openProject;

export const loadDirectoryChildren = async ({ state }: Context, dirPath: string) => {
  const updateTree = async (nodes: FileTreeNode[]): Promise<FileTreeNode[]> => {
    return Promise.all(
      nodes.map(async (node) => {
        if (node.path === dirPath && node.isDirectory && !node.childrenLoaded) {
          const children = await loadTreeLevel(dirPath);
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

const prepareFileContent = async (
  { state }: Context,
  filePath: string,
  content: string,
) => {
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

  return prepared.content;
};

export const openFile = async ({ state, actions }: Context, filePath: string) => {
  if (!window.electronAPI || !state.project.isProjectReady || !state.project.rootPath) return;

  const existing = state.project.openTabs.find((tab) => tab.filePath === filePath);
  if (existing) {
    await actions.project.switchTab({ filePath });
    return;
  }

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
};

export const switchTab = async (
  { state, actions }: Context,
  { content, filePath }: { content?: string; filePath: string },
) => {
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
    tab.content = await prepareFileContent({ state, actions } as Context, tab.filePath, tab.content);
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
  { state }: Context,
  { content }: { content: string },
): Promise<{ success: boolean; error?: string }> => {
  if (!window.electronAPI || !state.project.activeTabPath) {
    return { success: false, error: 'No active file' };
  }

  const filePath = state.project.activeTabPath;

  try {
    await window.electronAPI.writeFile(filePath, content);
    state.project.openTabs = state.project.openTabs.map((tab) =>
      tab.filePath === filePath ? { ...tab, content, dirty: false } : tab,
    );
    state.editor.contentLastSaved = content;
    state.editor.contentHasChanged = false;
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to save file' };
  }
};

export const saveActiveTabAs = async (
  { state, actions }: Context,
  { content }: { content: string },
): Promise<{ success: boolean; cancelled?: boolean; error?: string }> => {
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

  let filePath: string | null;
  try {
    filePath = await window.electronAPI.saveFileAs(previousPath);
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
    await window.electronAPI.writeFile(filePath, content);
    const filename = getFilename(filePath);

    if (previousPath) {
      state.project.openTabs = state.project.openTabs.map((tab) =>
        tab.filePath === previousPath
          ? { ...tab, filePath, filename, content, dirty: false }
          : tab,
      );
      state.project.activeTabPath = filePath;
    } else {
      state.project.openTabs = [
        ...state.project.openTabs,
        { content, dirty: false, editorReady: true, filePath, filename },
      ];
      state.project.activeTabPath = filePath;
    }

    await actions.editor.setResource({
      content,
      filePath,
      filename,
      isLocal: true,
    });

    state.editor.contentLastSaved = content;
    state.editor.contentHasChanged = false;
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save file',
    };
  }
};

export const closeTab = async (
  { state, actions }: Context,
  { content, filePath }: { content?: string; filePath: string },
) => {
  if (content) {
    const tab = state.project.openTabs.find((item) => item.filePath === filePath);
    if (tab) tab.content = content;
  }

  const remaining = state.project.openTabs.filter((tab) => tab.filePath !== filePath);
  state.project.openTabs = remaining;

  if (state.project.activeTabPath !== filePath) return;

  if (remaining.length === 0) {
    state.project.activeTabPath = null;
    await actions.editor.clearResource();
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
  }
};
