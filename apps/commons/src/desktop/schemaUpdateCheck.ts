import type { ProjectBundle } from './projectTypes';
import type { SchemaUpdateCheckOptions, SchemaUpdateCheckResult } from './schemaUpdateTypes';

const buildUpdateMessage = (result: Extract<SchemaUpdateCheckResult, { status: 'updateAvailable' }>) => {
  const lines = [`A newer version of ${result.catalogLabel} may be available.`];

  if (result.localVersion && result.remoteVersion) {
    lines.push(`Installed: ${result.localVersion}. Available: ${result.remoteVersion}.`);
  } else if (result.remoteVersion) {
    lines.push(`Available version: ${result.remoteVersion}.`);
  }

  if (result.rngChanged) {
    lines.push('The RelaxNG schema file has changed upstream.');
  }
  if (result.cssChanged) {
    lines.push('The CSS stylesheet has changed upstream.');
  }

  return lines.join('\n');
};

const skippedMessage = (reason: string): string => {
  switch (reason) {
    case 'Not a catalog-installed schema':
      return 'This project uses a local schema — no online update check.';
    case 'Could not reach schema source':
      return 'Could not reach the schema source. Check your network connection.';
    case 'Checked recently':
      return 'Schema was checked recently.';
    default:
      return reason;
  }
};

export interface SchemaUpdateFlowOptions {
  force?: boolean;
  notify: (message: string) => void;
  onBundleUpdated?: (bundle: ProjectBundle) => void;
}

const promptAndApplySchemaUpdate = async (
  projectFilePath: string,
  result: Extract<SchemaUpdateCheckResult, { status: 'updateAvailable' }>,
  { notify, onBundleUpdated }: Pick<SchemaUpdateFlowOptions, 'notify' | 'onBundleUpdated'>,
) => {
  const { response } = await window.electronAPI!.showNativeMessageBox({
    type: 'question',
    title: 'Schema update available',
    message: buildUpdateMessage(result),
    buttons: ['Update now', 'Not now'],
    defaultId: 0,
    cancelId: 1,
  });

  if (response !== 0) return;

  const applyResult = await window.electronAPI!.applyCatalogSchemaUpdate(projectFilePath);
  const warnings = applyResult?.metadataWarnings ?? [];

  if (applyResult?.bundle) {
    try {
      onBundleUpdated?.(applyResult.bundle);
    } catch (refreshError) {
      console.error('[schemaUpdate] editor refresh failed after apply:', refreshError);
    }
  }

  if (warnings.length > 0) {
    notify(warnings.join(' '));
  } else {
    notify('Schema updated successfully.');
  }
};

export const runSchemaUpdateFlow = async (
  projectFilePath: string,
  { force = false, notify, onBundleUpdated }: SchemaUpdateFlowOptions,
) => {
  if (!window.electronAPI?.checkSchemaUpdate) return;

  const checkOptions: SchemaUpdateCheckOptions | undefined = force ? { force: true } : undefined;
  const result = await window.electronAPI.checkSchemaUpdate(projectFilePath, checkOptions);

  if (result.status === 'current') {
    if (force) notify('Schema is up to date.');
    return;
  }

  if (result.status === 'skipped') {
    if (force) notify(skippedMessage(result.reason));
    return;
  }

  await promptAndApplySchemaUpdate(projectFilePath, result, { notify, onBundleUpdated });
};

export interface SchemaUpdateOnOpenOptions {
  notify: (message: string) => void;
  onBundleUpdated?: (bundle: ProjectBundle) => void;
}

export const maybeCheckSchemaUpdateOnOpen = async (
  projectFilePath: string,
  options: SchemaUpdateOnOpenOptions,
) => {
  if (!window.electronAPI?.checkSchemaUpdate) return;

  try {
    const result = await window.electronAPI.checkSchemaUpdate(projectFilePath);
    if (result.status !== 'updateAvailable') return;
    await promptAndApplySchemaUpdate(projectFilePath, result, options);
  } catch (error) {
    console.error('[schemaUpdate] check or apply failed:', error);
    options.notify(
      'Could not update the project schema. Check your network connection and try again.',
    );
  }
};

export const checkSchemaUpdateManually = async (
  projectFilePath: string,
  options: SchemaUpdateOnOpenOptions,
) => {
  if (!window.electronAPI?.checkSchemaUpdate) {
    options.notify('Schema update check is unavailable. Restart the desktop app.');
    return;
  }

  try {
    await runSchemaUpdateFlow(projectFilePath, { ...options, force: true });
  } catch (error) {
    console.error('[schemaUpdate] manual check failed:', error);
    options.notify(
      'Could not update the project schema. Check your network connection and try again.',
    );
  }
};
