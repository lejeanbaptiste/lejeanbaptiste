import { getParentPath } from './explorer/treeUtils';
import { joinProjectPath } from './projectFile';

export interface SaveAsDefaultsInput {
  rootPath: string | null;
  explorerFocusedPath: string | null;
  explorerFocusedIsDirectory: boolean;
  filename: string;
  previousPath?: string;
  isTempFile: boolean;
}

/** Directory used as Save As default (explorer focus, else project root). */
export const resolveSaveAsDirectory = (input: {
  rootPath: string | null;
  explorerFocusedPath: string | null;
  explorerFocusedIsDirectory: boolean;
}): string | null => {
  if (!input.rootPath) return null;

  const { explorerFocusedPath, explorerFocusedIsDirectory, rootPath } = input;
  if (explorerFocusedPath?.startsWith(rootPath)) {
    if (explorerFocusedIsDirectory) return explorerFocusedPath;
    const parent = getParentPath(explorerFocusedPath);
    if (parent?.startsWith(rootPath)) return parent;
  }

  return rootPath;
};

export const getDefaultSaveAsPath = (input: SaveAsDefaultsInput): string | undefined => {
  if (!input.rootPath) return input.previousPath;

  if (input.isTempFile) {
    const directory = resolveSaveAsDirectory(input);
    if (!directory) return input.previousPath;
    return joinProjectPath(directory, input.filename);
  }

  if (input.previousPath && input.previousPath.startsWith(input.rootPath)) {
    return input.previousPath;
  }

  const directory = resolveSaveAsDirectory(input);
  if (!directory) return undefined;
  return joinProjectPath(directory, input.filename);
};
