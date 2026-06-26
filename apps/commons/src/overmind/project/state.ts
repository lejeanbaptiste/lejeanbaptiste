import type { Types } from '@cwrc/leafwriter';
import type { ProjectFileConfig } from './projectFile';

export interface FileTreeNode {
  children?: FileTreeNode[];
  childrenLoaded?: boolean;
  isDirectory: boolean;
  name: string;
  path: string;
}

export interface OpenTab {
  content: string;
  dirty: boolean;
  editorReady: boolean;
  filePath: string;
  filename: string;
}

export interface ProjectState {
  activeTabPath: string | null;
  config: ProjectFileConfig | null;
  isProjectReady: boolean;
  openTabs: OpenTab[];
  projectFilePath: string | null;
  projectSchemas: Types.Schema[];
  rootPath: string | null;
  tree: FileTreeNode[];
}

export const state: ProjectState = {
  activeTabPath: null,
  config: null,
  isProjectReady: false,
  openTabs: [],
  projectFilePath: null,
  projectSchemas: [],
  rootPath: null,
  tree: [],
};
