import { getDatabaseId, TAG_TO_KIND } from './entities';
import { listEntities } from './entityOps';
import type { EntityStore } from './entityStore';
import { purgeEntityKeys } from './mentions';
import {
  orphanPurgeRemap,
  sweepOrphans,
  type OrphanSweepReport,
} from './orphanSweep';
import { rewriteMentionKeys } from './rewriteMentionKeys';

export interface EntityDatabaseCheckInput {
  projectDatabaseId?: string;
  projectRoot: string;
  projectFilePath: string;
}

export interface EntityDatabaseCheckApi {
  listProjectXmlFiles: (rootPath: string) => Promise<{ name: string; path: string }[]>;
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  showNativeMessageBox?: (options: {
    type?: 'error' | 'info' | 'none' | 'question' | 'warning';
    title: string;
    message: string;
    detail?: string;
    buttons?: string[];
    defaultId?: number;
    cancelId?: number;
  }) => Promise<{ response: number }>;
  updateProjectFileConfig?: (
    projectFilePath: string,
    patch: Record<string, unknown>,
  ) => Promise<unknown>;
}

export interface EntityDatabaseCheckResult {
  status: 'ok' | 'cancelled' | 'purged' | 'linked';
  databaseId: string | null;
}

/** Compare project fingerprint to the active entity database. */
export async function checkEntityDatabaseFingerprint(
  store: EntityStore,
  input: EntityDatabaseCheckInput,
): Promise<{ databaseId: string | null; mismatch: boolean }> {
  const doc = await store.loadEntities();
  const databaseId = getDatabaseId(doc);
  const mismatch = Boolean(
    input.projectDatabaseId && databaseId && input.projectDatabaseId !== databaseId,
  );
  // eslint-disable-next-line no-console
  console.info('[entity-db-check] fingerprint compare', {
    entitiesPath: store.entitiesPath,
    mode: store.mode,
    centralFolder: store.centralFolder,
    projectRoot: input.projectRoot,
    projectFilePath: input.projectFilePath,
    projectDatabaseId: input.projectDatabaseId ?? null,
    activeDatabaseId: databaseId,
    mismatch,
  });
  return { databaseId, mismatch };
}

/** Strip @key from every disambiguation tag in all project XML files. */
export async function purgeEntityKeysInProject(
  api: EntityDatabaseCheckApi,
  projectRoot: string,
): Promise<number> {
  let total = 0;
  const files = await api.listProjectXmlFiles(projectRoot);
  for (const file of files) {
    if (file.name === 'entities.xml') continue;
    const xml = await api.readFile(file.path);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const count = purgeEntityKeys(doc);
    if (count > 0) {
      await api.writeFile(file.path, new XMLSerializer().serializeToString(doc));
      total += count;
    }
  }
  return total;
}

/**
 * Scan the corpus for `@key`s that no longer resolve to any entity in the
 * database, classified (via the per-file PEDB stamp) into genuine orphans vs
 * misfiled "stray" files. This is the safe, precise alternative to the
 * wholesale purge: it never strips keys in a file that belongs to a *different*
 * project database.
 */
export async function sweepProjectOrphans(
  store: EntityStore,
  api: EntityDatabaseCheckApi,
  projectRoot: string,
): Promise<OrphanSweepReport> {
  const doc = await store.loadEntities();
  const pedbIds = new Set(listEntities(doc).map((entity) => entity.id));
  const fingerprint = getDatabaseId(doc) ?? '';
  const files = await api.listProjectXmlFiles(projectRoot);
  const corpus: { path: string; xml: string }[] = [];
  for (const file of files) {
    if (file.name === 'entities.xml') continue;
    corpus.push({ path: file.path, xml: await api.readFile(file.path) });
  }
  return sweepOrphans(corpus, pedbIds, fingerprint);
}

/**
 * Strip only the *genuine* orphan keys from the report's files (stray files are
 * never touched). Returns how many keys were removed. String-based rewrite so
 * corpus formatting is preserved.
 */
export async function purgeReportedOrphans(
  api: EntityDatabaseCheckApi,
  report: OrphanSweepReport,
): Promise<number> {
  const remap = orphanPurgeRemap(report);
  if (Object.keys(remap).length === 0) return 0;
  let total = 0;
  for (const file of report.orphanFiles) {
    const xml = await api.readFile(file.path);
    const result = rewriteMentionKeys(xml, remap);
    if (result.changed) {
      await api.writeFile(file.path, result.xml);
      total += result.count;
    }
  }
  return total;
}

/**
 * On project open: link silently when no fingerprint is stored; warn on mismatch
 * and offer purge-keys recovery (import is deferred).
 */
export async function runEntityDatabaseCheck(
  store: EntityStore,
  input: EntityDatabaseCheckInput,
  api: EntityDatabaseCheckApi,
): Promise<EntityDatabaseCheckResult> {
  const { databaseId, mismatch } = await checkEntityDatabaseFingerprint(store, input);

  if (!databaseId) {
    return { status: 'ok', databaseId: null };
  }

  if (!input.projectDatabaseId && api.updateProjectFileConfig) {
    // eslint-disable-next-line no-console
    console.info('[entity-db-check] linking project to database for the first time', {
      entitiesPath: store.entitiesPath,
      projectFilePath: input.projectFilePath,
      databaseId,
    });
    await api.updateProjectFileConfig(input.projectFilePath, { entityDatabaseId: databaseId });
    return { status: 'linked', databaseId };
  }

  if (!mismatch) {
    return { status: 'ok', databaseId };
  }

  if (!api.showNativeMessageBox) {
    return { status: 'cancelled', databaseId };
  }

  // eslint-disable-next-line no-console
  console.info('[entity-db-check] showing mismatch prompt', {
    entitiesPath: store.entitiesPath,
    projectFilePath: input.projectFilePath,
    projectDatabaseId: input.projectDatabaseId,
    activeDatabaseId: databaseId,
  });

  const { response } = await api.showNativeMessageBox({
    type: 'warning',
    title: 'Entity database mismatch',
    message: 'This project was linked to a different entity database.',
    detail:
      'This can mean the database was genuinely swapped, or that Settings > Entity database ' +
      'is pointing at the wrong folder and your existing keys are still valid. Check that ' +
      'setting first — purging is destructive and only appropriate once you have confirmed ' +
      'the keys really do not match.',
    buttons: ['Cancel', 'Purge keys'],
    defaultId: 0,
    cancelId: 0,
  });

  // eslint-disable-next-line no-console
  console.info('[entity-db-check] mismatch prompt response', {
    response,
    action: response === 1 ? 'purge' : 'cancel',
  });

  if (response === 1) {
    await purgeEntityKeysInProject(api, input.projectRoot);
    if (api.updateProjectFileConfig) {
      await api.updateProjectFileConfig(input.projectFilePath, { entityDatabaseId: databaseId });
    }
    return { status: 'purged', databaseId };
  }

  return { status: 'cancelled', databaseId };
}

/** Tags eligible for entity disambiguation. */
export function disambiguationTags(): string[] {
  return Object.keys(TAG_TO_KIND);
}
