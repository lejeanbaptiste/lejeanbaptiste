import { maybeOfferAuthorityDatabases } from './authorityDbOnboarding';
import { maybeOfferChineseAssetDownloads } from './chineseAssetOnboarding';
import { joinProjectPath, type ProjectBundle } from './projectFile';
import { metadataFileExists } from './projectMetadata';
import { getProjectSourceLanguage, projectRequiresSourceLanguage } from './projectLanguage';
import { openApplicationSettings } from './openApplicationSettings';
import { openNativeProjectMetadata } from './openNativeProjectMetadata';
import { openNativeSchemaSetup } from './openNativeSchemaSetup';
import { ensureEntityDbFolder } from './entityDbOnboarding';
import { isDesktop } from '@src/types/desktop';
import type { DialogBarProps } from '../dialogs';

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
  } else if (
    window.electronAPI?.pluginsEnsureSchemaContribution &&
    (await window.electronAPI.pluginsIsEnabled?.('cjk-dates'))
  ) {
    log('schema present — ensuring cjk-dates schema contribution');
    const mergeResult = await window.electronAPI.pluginsEnsureSchemaContribution(
      'cjk-dates',
      current.projectFilePath,
    );
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
 * Onboarding steps that run only after the project is ready. The Chinese
 * asset chooser uses the always-mounted desktop dialog host, so it is also
 * available before an XML file initializes the embedded editor.
 */
export const completePostLoadOnboarding = async (
  bundle: ProjectBundle,
  openDialog: (dialog: DialogBarProps) => void,
): Promise<ProjectBundle> => {
  if (!isDesktop()) return bundle;

  const log = (step: string) => console.info(`[onboarding] ${step}`);
  const current = bundle;

  log('ensuring entity db folder');
  await ensureEntityDbFolder();

  // Chinese projects use the combined chooser below; other supported
  // languages retain the authority-only prompt.
  if (!(await getProjectSourceLanguage(current))?.toLowerCase().startsWith('zh')) {
    void maybeOfferAuthorityDatabases(current).catch(() => undefined);
  }

  // Non-blocking, once per project open: prompt for any remaining Chinese
  // assets (map tiles, CHGIS, …) still missing after the check above.
  void maybeOfferChineseAssetDownloads(current, openDialog).catch((error) =>
    console.error('[onboarding] Chinese asset download prompt failed:', error),
  );

  log('post-load onboarding complete');
  return current;
};

export const openEditionMetadataDialog = async (
  _projectFilePath: string,
): Promise<'saved' | 'cancelled'> => {
  const opened = await openApplicationSettings({ initialTab: 'project' });
  return opened ? 'cancelled' : 'cancelled';
};
