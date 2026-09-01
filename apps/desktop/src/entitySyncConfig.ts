/**
 * Configuration for cross-device entity sync (docs/entity-sync-planning.md).
 *
 * Endpoint, on/off flag, poll interval, and how to authenticate — plain JSON
 * in userData, no encryption. Secrets stay out of this file: the GitHub token
 * lives in `leaderboard-auth.json`, and a static bearer token (if used) is
 * kept encrypted by `entitySyncAuthSecret.ts`.
 *
 * `auth.mode` decouples the client from any one provider — see
 * `entitySyncTokenProvider.ts` and docs/entity-sync-protocol.md.
 */
import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

/** How the client obtains a bearer token for the sync server. */
export type SyncAuthMode = 'github' | 'oidc' | 'bearer';

export interface EntitySyncAuth {
  mode: SyncAuthMode;
  /** oidc: OpenID Connect issuer / realm URL (no trailing slash). */
  issuer?: string;
  /** oidc: public client id for the device flow. */
  clientId?: string;
}

export interface EntitySyncConfig {
  enabled: boolean;
  /** Base URL of the sync server, e.g. https://ljb-entity-sync.<sub>.workers.dev */
  endpoint: string;
  /** Auto-sync cadence while the app is running. */
  intervalMinutes: number;
  auth: EntitySyncAuth;
}

const CONFIG_FILENAME = 'entity-sync-config.json';
const MIN_INTERVAL_MINUTES = 1;
const MAX_INTERVAL_MINUTES = 24 * 60;
const DEFAULT_INTERVAL_MINUTES = 5;
const AUTH_MODES: readonly SyncAuthMode[] = ['github', 'oidc', 'bearer'];

const getConfigPath = () => path.join(app.getPath('userData'), CONFIG_FILENAME);

const clampInterval = (value: unknown): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : NaN;
  if (Number.isNaN(n)) return DEFAULT_INTERVAL_MINUTES;
  return Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, n));
};

const trimmedOrUndefined = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const sanitizeAuth = (value: Partial<EntitySyncAuth> | undefined): EntitySyncAuth => ({
  mode: AUTH_MODES.includes(value?.mode as SyncAuthMode) ? (value?.mode as SyncAuthMode) : 'github',
  issuer: trimmedOrUndefined(value?.issuer)?.replace(/\/+$/, ''),
  clientId: trimmedOrUndefined(value?.clientId),
});

const sanitize = (value: Partial<EntitySyncConfig> | undefined): EntitySyncConfig => ({
  enabled: value?.enabled === true,
  endpoint: typeof value?.endpoint === 'string' ? value.endpoint.trim().replace(/\/+$/, '') : '',
  intervalMinutes: clampInterval(value?.intervalMinutes),
  auth: sanitizeAuth(value?.auth),
});

export const readSyncConfig = async (): Promise<EntitySyncConfig> => {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf-8');
    return sanitize(JSON.parse(raw) as Partial<EntitySyncConfig>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return sanitize(undefined);
    // A corrupt config shouldn't wedge sync setup — fall back to defaults.
    return sanitize(undefined);
  }
};

export type EntitySyncConfigPatch = Partial<Omit<EntitySyncConfig, 'auth'>> & {
  auth?: Partial<EntitySyncAuth>;
};

export const writeSyncConfig = async (patch: EntitySyncConfigPatch): Promise<EntitySyncConfig> => {
  const current = await readSyncConfig();
  const merged = sanitize({
    ...current,
    ...patch,
    auth: patch.auth ? { ...current.auth, ...patch.auth } : current.auth,
  });
  const configPath = getConfigPath();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(`${configPath}.tmp`, JSON.stringify(merged, null, 2));
  await fs.rename(`${configPath}.tmp`, configPath);
  return merged;
};

export const isSyncConfigured = (config: EntitySyncConfig): boolean =>
  config.enabled && config.endpoint.length > 0;

export const syncConfigConstants = {
  MIN_INTERVAL_MINUTES,
  MAX_INTERVAL_MINUTES,
  DEFAULT_INTERVAL_MINUTES,
  AUTH_MODES,
};
