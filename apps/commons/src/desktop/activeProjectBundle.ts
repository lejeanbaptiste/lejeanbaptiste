import type { ProjectBundle } from './projectTypes';

let activeProjectBundle: ProjectBundle | null = null;

export const setActiveProjectBundle = (bundle: ProjectBundle | null) => {
  activeProjectBundle = bundle;
};

export const getActiveProjectBundle = (): ProjectBundle | null => activeProjectBundle;

export const resolveProjectBundleByPath = async (
  projectFilePath: string,
): Promise<ProjectBundle | null> => {
  if (activeProjectBundle?.projectFilePath === projectFilePath) {
    return activeProjectBundle;
  }
  return window.electronAPI?.reloadProjectBundle?.(projectFilePath) ?? null;
};
