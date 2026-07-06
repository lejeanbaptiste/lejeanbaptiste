import { maybeOfferAuthorityDatabases } from './authorityDbOnboarding';
import { joinProjectPath, type ProjectBundle } from './projectFile';
import { metadataFileExists } from './projectMetadata';
import { getProjectSourceLanguage, projectRequiresSourceLanguage } from './projectLanguage';
import { openNativeProjectMetadata } from './openNativeProjectMetadata';
import { openNativeSchemaSetup } from './openNativeSchemaSetup';
import { ensureEntityDbFolder, projectHasEntityStorePreference } from './entityDbOnboarding';
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
  } else if (window.electronAPI?.ensureSanmiaoDatesSchema) {
    await window.electronAPI.ensureSanmiaoDatesSchema(current.projectFilePath);
  }

  if (!(await metadataFileExists(current))) {
    const saved = await openNativeProjectMetadata(current.projectFilePath, 'firstSetup');
    if (saved !== 'saved') return null;

    if (window.electronAPI?.reloadProjectBundle) {
      const reloaded = await window.electronAPI.reloadProjectBundle(current.projectFilePath);
      if (reloaded) current = reloaded;
    }
  }

  // Source language is mandatory (auto-tagging Phase A0): legacy projects
  // saved before the fixed-code picker must set one before proceeding.
  if (projectRequiresSourceLanguage(current) && !(await getProjectSourceLanguage(current))) {
    const saved = await openNativeProjectMetadata(current.projectFilePath, 'edition');
    if (saved !== 'saved') return null;
    if (window.electronAPI?.reloadProjectBundle) {
      const reloaded = await window.electronAPI.reloadProjectBundle(current.projectFilePath);
      if (reloaded) current = reloaded;
    }
    if (!(await getProjectSourceLanguage(current))) return null;
  }

  if (!(await ensureEntityDbFolder())) return null;

  if (!(await projectHasEntityStorePreference(current.projectFilePath))) {
    const saved = await openNativeProjectMetadata(current.projectFilePath, 'edition');
    if (saved !== 'saved') return null;
    if (window.electronAPI?.reloadProjectBundle) {
      const reloaded = await window.electronAPI.reloadProjectBundle(current.projectFilePath);
      if (reloaded) current = reloaded;
    }
  }

  // Non-blocking: the authority-database offer (Chinese projects only) must
  // not hold up project open, and downloads run in the main process.
  void maybeOfferAuthorityDatabases(current).catch(() => undefined);

  return current;
};

export const openEditionMetadataDialog = async (
  projectFilePath: string,
): Promise<'saved' | 'cancelled'> => openNativeProjectMetadata(projectFilePath, 'edition');
