import type { FileTreeNode } from '@src/overmind/project/state';

const splitPath = (filePath: string) => filePath.split(/[/\\]/);

export const getPathBasename = (filePath: string) => {
  const parts = splitPath(filePath);
  return parts[parts.length - 1] ?? filePath;
};

export const getParentPath = (filePath: string) => {
  const parts = splitPath(filePath);
  parts.pop();
  return parts.join('/') || '/';
};

export const joinPath = (...parts: string[]) => parts.filter(Boolean).join('/').replace(/\/+/g, '/');

export const updateTreeNode = (
  nodes: FileTreeNode[],
  targetPath: string,
  updater: (node: FileTreeNode) => FileTreeNode,
): FileTreeNode[] =>
  nodes.map((node) => {
    if (node.path === targetPath) return updater(node);
    if (node.children) {
      return { ...node, children: updateTreeNode(node.children, targetPath, updater) };
    }
    return node;
  });

export const removeTreeNode = (nodes: FileTreeNode[], targetPath: string): FileTreeNode[] =>
  nodes
    .filter((node) => node.path !== targetPath)
    .map((node) =>
      node.children
        ? { ...node, children: removeTreeNode(node.children, targetPath) }
        : node,
    );

const repathSingle = (filePath: string, oldPath: string, newPath: string): string | null => {
  if (filePath === oldPath) return newPath;
  const prefix = oldPath.endsWith('/') ? oldPath : `${oldPath}/`;
  if (filePath.startsWith(prefix)) {
    return `${newPath}${filePath.slice(oldPath.length)}`;
  }
  return null;
};

export const repathTreeSubtree = (
  nodes: FileTreeNode[],
  oldPath: string,
  newPath: string,
): FileTreeNode[] => {
  const mapNode = (node: FileTreeNode): FileTreeNode | null => {
    const updatedPath = repathSingle(node.path, oldPath, newPath);
    if (updatedPath) {
      return {
        ...node,
        path: updatedPath,
        name: getPathBasename(updatedPath),
        children: node.children?.map(mapNode).filter(Boolean) as FileTreeNode[] | undefined,
      };
    }

    if (node.children) {
      return { ...node, children: node.children.map(mapNode).filter(Boolean) as FileTreeNode[] };
    }

    return node;
  };

  return nodes.map(mapNode).filter(Boolean) as FileTreeNode[];
};

export const getRelativeFolderLabel = (filePath: string, rootPath: string): string => {
  const parent = getParentPath(filePath);
  if (parent === rootPath || !parent.startsWith(rootPath)) return '';
  const relative = parent.slice(rootPath.length).replace(/^[/\\]+/, '');
  return relative ? `${relative}/` : '';
};

/** Absolute path of the project schema directory (default `schema/`). */
export const getProjectSchemaDirPath = (
  rootPath: string,
  schema?: { rng?: string } | null,
): string => {
  const rng = schema?.rng?.trim();
  if (rng) {
    const parts = rng.split(/[/\\]/).filter(Boolean);
    if (parts.length > 1) {
      return joinPath(rootPath, ...parts.slice(0, -1));
    }
  }
  return joinPath(rootPath, 'schema');
};

export const isPathUnder = (targetPath: string, parentPath: string): boolean => {
  if (targetPath === parentPath) return true;
  const prefix = parentPath.endsWith('/') ? parentPath : `${parentPath}/`;
  const winPrefix = parentPath.endsWith('\\') ? parentPath : `${parentPath}\\`;
  return targetPath.startsWith(prefix) || targetPath.startsWith(winPrefix);
};

/** Omit the project schema directory from explorer listings (children load only if expanded). */
export const shouldHideExplorerDirectoryEntry = (
  entryPath: string,
  schemaDirPath: string | null | undefined,
): boolean => Boolean(schemaDirPath && entryPath === schemaDirPath);

export const repathFilePath = (filePath: string, oldPath: string, newPath: string): string | null =>
  repathSingle(filePath, oldPath, newPath);
