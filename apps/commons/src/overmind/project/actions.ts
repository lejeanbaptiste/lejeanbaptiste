import type { Context } from '../';
import { prepareDesktopDocument } from '@src/desktop/resolveDocumentSchemas';
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

export const openProjectFolder = async ({ state }: Context) => {
  if (!window.electronAPI) return;

  const result = await window.electronAPI.openProjectFolder();
  if (!result) return;

  state.project.rootPath = result.rootPath;
  state.project.tree = await loadTreeLevel(result.rootPath);
};

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

const patchDesktopContent = async (
  filePath: string,
  content: string,
  projectRoot: string | null,
) => {
  const prepared = await prepareDesktopDocument(filePath, content, projectRoot);
  return prepared.content;
};

export const openFile = async ({ state, actions }: Context, filePath: string) => {
  if (!window.electronAPI) return;

  const existing = state.project.openTabs.find((tab) => tab.filePath === filePath);
  if (existing) {
    await actions.project.switchTab({ filePath });
    return;
  }

  let content = await window.electronAPI.readFile(filePath);
  content = await patchDesktopContent(filePath, content, state.project.rootPath);
  const filename = getFilename(filePath);
  const tab = { content, dirty: false, filePath, filename };

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
        savedContent = await patchDesktopContent(
          currentTab.filePath,
          content,
          state.project.rootPath,
        );
      }
      currentTab.content = savedContent;
      currentTab.dirty = savedContent !== state.editor.contentLastSaved;
    }
  }

  const tab = state.project.openTabs.find((item) => item.filePath === filePath);
  if (!tab) return;

  tab.content = await patchDesktopContent(tab.filePath, tab.content, state.project.rootPath);

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
    const tab = state.project.openTabs.find((item) => item.filePath === filePath);
    if (tab) {
      tab.content = content;
      tab.dirty = false;
    }
    state.editor.contentLastSaved = content;
    state.editor.contentHasChanged = false;
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to save file' };
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
  const tab = state.project.openTabs.find((item) => item.filePath === state.project.activeTabPath);
  if (tab) tab.dirty = dirty;
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
