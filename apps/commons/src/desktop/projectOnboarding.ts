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

  const log = (step: string) => console.info(`[onboarding] ${step}`);
  let current = bundle;

  log(`start: ${bundle.projectFilePath}`);
  if (!(await projectHasSchema(current))) {
    log('no schema — opening schema setup dialog');
    const setup = await openNativeSchemaSetup(current.projectFilePath);
    log(`schema setup result: ${setup.result}`);
    if (setup.result !== 'installed' || !setup.bundle) return null;
    current = setup.bundle;
  } else if (window.electronAPI?.ensureSanmiaoDatesSchema) {
    log('schema present — ensuring sanmiao dates schema');
    const mergeResult = await window.electronAPI.ensureSanmiaoDatesSchema(current.projectFilePath);
    log(`sanmiao merge: ${mergeResult.merged}`);
    if (mergeResult.merged && window.writer) {
      await window.writer.overmindActions?.validator?.clearCache?.();
      window.writer.schemaManager?.clearSchemaRevision?.();
    }
  }

  if (!(await metadataFileExists(current))) {
    log('no metadata — opening project metadata dialog');
    const saved = await openNativeProjectMetadata(current.projectFilePath, 'firstSetup');
    log(`metadata dialog result: ${saved}`);
    if (saved !== 'saved') return null;

    if (window.electronAPI?.reloadProjectBundle) {
      const reloaded = await window.electronAPI.reloadProjectBundle(current.projectFilePath);
      if (reloaded) current = reloaded;
    }
  }

  // Source language is mandatory (auto-tagging Phase A0): legacy projects
  // saved before the fixed-code picker must set one before proceeding.
  if (projectRequiresSourceLanguage(current) && !(await getProjectSourceLanguage(current))) {
    log('missing source language — opening metadata dialog');
    const saved = await openNativeProjectMetadata(current.projectFilePath, 'edition');
    log(`source language dialog result: ${saved}`);
    if (saved !== 'saved') return null;
    if (window.electronAPI?.reloadProjectBundle) {
      const reloaded = await window.electronAPI.reloadProjectBundle(current.projectFilePath);
      if (reloaded) current = reloaded;
    }
    if (!(await getProjectSourceLanguage(current))) return null;
  }

  log('complete');
  return current;
};

/**
 * Onboarding steps that need the app's embedded UI (e.g. the settings
 * dialog), which only exists once the project has actually loaded and
 * `<ProjectEditor>` has mounted. Must run *after* the caller has marked the
 * project ready — running it earlier (as part of `completeProjectOnboarding`)
 * deadlocks, since the embedded dialog can't open before that mount, and
 * that mount can't happen before onboarding completes.
 */
export const completePostLoadOnboarding = async (bundle: ProjectBundle): Promise<ProjectBundle> => {
  if (!isDesktop()) return bundle;

  const log = (step: string) => console.info(`[onboarding] ${step}`);
  let current = bundle;

  log('ensuring entity db folder');
  if (await ensureEntityDbFolder()) {
    if (!(await projectHasEntityStorePreference(current.projectFilePath))) {
      log('no entity store preference — opening metadata dialog');
      const saved = await openNativeProjectMetadata(current.projectFilePath, 'edition');
      log(`entity store dialog result: ${saved}`);
      if (saved === 'saved' && window.electronAPI?.reloadProjectBundle) {
        const reloaded = await window.electronAPI.reloadProjectBundle(current.projectFilePath);
        if (reloaded) current = reloaded;
      }
    }
  }

  // Non-blocking: the authority-database offer (Chinese projects only) must
  // not hold up project open, and downloads run in the main process.
  void maybeOfferAuthorityDatabases(current).catch(() => undefined);

  log('post-load onboarding complete');
  return current;
};

export const openEditionMetadataDialog = async (
  projectFilePath: string,
): Promise<'saved' | 'cancelled'> => openNativeProjectMetadata(projectFilePath, 'edition');
