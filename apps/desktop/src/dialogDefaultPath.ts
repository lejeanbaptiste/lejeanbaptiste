import path from 'path';

export const resolveDialogDefaultPath = (options: {
  entityDbFolder: string | null;
  homeDir: string;
  lastDialogDir: string | null;
  lastProjectFile: string | null;
  pathExists: (candidate: string) => boolean;
}): string => {
  const isEntityDbFolder = (candidate: string) =>
    !!options.entityDbFolder &&
    path.resolve(candidate) === path.resolve(options.entityDbFolder);

  const lastDir = options.lastDialogDir;
  if (lastDir && options.pathExists(lastDir) && !isEntityDbFolder(lastDir)) {
    return lastDir;
  }

  if (options.lastProjectFile) {
    const projectRoot = path.dirname(options.lastProjectFile);
    if (options.pathExists(projectRoot) && !isEntityDbFolder(projectRoot)) {
      return projectRoot;
    }
  }

  return options.homeDir;
};
