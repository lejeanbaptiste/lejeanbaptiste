/**
 * Unified "Look for Updates" — app binary, authority packs, plugins, and
 * (when a project is open) the catalog schema.
 */
import type { AppUpdateCheckResult } from './appUpdateTypes';
import type { AuthorityLifecycleStatus } from './authorityLifecycleTypes';
import type { SchemaUpdateCheckResult } from './schemaUpdateTypes';

export interface LookForUpdatesReport {
  app: AppUpdateCheckResult | null;
  authority: AuthorityLifecycleStatus | null;
  pluginUpdates: number;
  schema: SchemaUpdateCheckResult | null;
}

interface LookForUpdatesApi {
  checkForAppUpdates?: () => Promise<AppUpdateCheckResult>;
  authorityLifecycleMaybeCheckUpdates?: (options?: {
    force?: boolean;
  }) => Promise<AuthorityLifecycleStatus | null>;
  pluginsGetSnapshot?: () => Promise<{ plugins: { id: string; version: string }[] }>;
  pluginsGetRemoteIndex?: () => Promise<{ plugins: { id: string; version: string }[] }>;
  checkSchemaUpdate?: (
    projectFilePath: string,
    options?: { force?: boolean },
  ) => Promise<SchemaUpdateCheckResult>;
}

const countPluginUpdates = async (api: LookForUpdatesApi): Promise<number> => {
  if (!api.pluginsGetSnapshot || !api.pluginsGetRemoteIndex) return 0;
  const [installed, remote] = await Promise.all([
    api.pluginsGetSnapshot(),
    api.pluginsGetRemoteIndex(),
  ]);
  const installedVersionById = new Map(
    installed.plugins.map((plugin) => [plugin.id, plugin.version]),
  );
  return remote.plugins.filter((entry) => {
    const installedVersion = installedVersionById.get(entry.id);
    return installedVersion === undefined || installedVersion !== entry.version;
  }).length;
};

export const gatherUpdateReport = async (
  api: LookForUpdatesApi,
  options?: { projectFilePath?: string | null },
): Promise<LookForUpdatesReport> => {
  const projectFilePath = options?.projectFilePath?.trim() || null;

  const [app, authority, pluginUpdates, schema] = await Promise.all([
    api.checkForAppUpdates?.().catch(
      (error): AppUpdateCheckResult => ({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      }),
    ) ?? Promise.resolve(null),
    api.authorityLifecycleMaybeCheckUpdates?.({ force: true }).catch(() => null) ??
      Promise.resolve(null),
    countPluginUpdates(api).catch(() => 0),
    projectFilePath && api.checkSchemaUpdate
      ? api.checkSchemaUpdate(projectFilePath, { force: true }).catch(() => null)
      : Promise.resolve(null),
  ]);

  return { app, authority, pluginUpdates, schema };
};

/** True when every applicable channel is current (or N/A). */
export const everythingIsUpToDate = (report: LookForUpdatesReport): boolean => {
  const appOk =
    !report.app ||
    report.app.status === 'current' ||
    report.app.status === 'unsupported';
  const authorityOk = !report.authority?.enabled || !report.authority.updateAvailable;
  const pluginsOk = report.pluginUpdates === 0;
  const schemaOk =
    !report.schema ||
    report.schema.status === 'current' ||
    report.schema.status === 'skipped';
  return appOk && authorityOk && pluginsOk && schemaOk;
};
