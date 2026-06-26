import type { FileEntry } from '@src/types/desktop';

export interface FileTreeNode extends FileEntry {
  children?: FileTreeNode[];
  childrenLoaded?: boolean;
}

export interface OpenTab {
  content: string;
  dirty: boolean;
  filePath: string;
  filename: string;
}

export interface ProjectState {
  activeTabPath: string | null;
  openTabs: OpenTab[];
  rootPath: string | null;
  tree: FileTreeNode[];
}

export const state: ProjectState = {
  activeTabPath: null,
  openTabs: [],
  rootPath: null,
  tree: [],
};
