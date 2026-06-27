import { joinProjectPath, type ProjectBundle } from './projectFile';
import { metadataFileExists } from './projectMetadata';
import { openNativeProjectMetadata } from './openNativeProjectMetadata';
import { openNativeSchemaSetup } from './openNativeSchemaSetup';
import { isDesktop } from '@src/types/desktop';

const projectHasSchema = async (bundle: ProjectBundle): Promise<boolean> => {
  if (!bundle.config.schema?.rng || !window.electronAPI?.readFile) return false;
  try {
    await window.electronAPI.readFile(
      joinProjectPath(bundle.rootPath, bundle.config.schema.rng),
    );
    return true;
  } catch {
    return false;
  }
};

/** Resolve schema + first-time metadata before loadProjectBundle. Returns null if user cancelled. */
export const completeProjectOnboarding = async (
  bundle: ProjectBundle,
): Promise<ProjectBundle | null> => {
  if (!isDesktop()) return bundle;

  let current = bundle;

  if (!(await projectHasSchema(current))) {
    const setup = await openNativeSchemaSetup(current.projectFilePath);
    if (setup.result !== 'installed' || !setup.bundle) return null;
    current = setup.bundle;
  }

  if (!(await metadataFileExists(current))) {
    const saved = await openNativeProjectMetadata(current.projectFilePath, 'firstSetup');
    if (saved !== 'saved') return null;

    if (window.electronAPI?.reloadProjectBundle) {
      const reloaded = await window.electronAPI.reloadProjectBundle(current.projectFilePath);
      if (reloaded) current = reloaded;
    }
  }

  return current;
};

export const openEditionMetadataDialog = async (
  projectFilePath: string,
): Promise<'saved' | 'cancelled'> => openNativeProjectMetadata(projectFilePath, 'edition');
