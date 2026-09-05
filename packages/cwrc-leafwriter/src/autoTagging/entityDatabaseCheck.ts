import i18next from 'i18next';
import { TAG_TO_KIND, type EntityKind } from './entities';

const { t } = i18next;
import type { EntityStore } from './entityStore';
import { purgeEntityKeys } from './mentions';
import { orphanPurgeRemap, sweepOrphans, type OrphanSweepReport } from './orphanSweep';
import { rewriteMentionKeys } from './rewriteMentionKeys';
import { SQLITE_REQUIRED_LOOKUP_MESSAGE } from './sqliteRequired';

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
  if (!(await store.hasSqliteDatabase())) {
    throw new Error(SQLITE_REQUIRED_LOOKUP_MESSAGE);
  }
  const databaseId = await store.sqliteDatabaseId();
  const mismatch = Boolean(
    input.projectDatabaseId && databaseId && input.projectDatabaseId !== databaseId,
  );

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
  if (!(await store.hasSqliteDatabase())) {
    throw new Error(SQLITE_REQUIRED_LOOKUP_MESSAGE);
  }
  const sqliteIds = await store.sqliteEntityIds();
  if (sqliteIds == null) {
    throw new Error(SQLITE_REQUIRED_LOOKUP_MESSAGE);
  }
  const pedbIds = new Set(sqliteIds);
  const fingerprint = (await store.sqliteDatabaseId()) ?? '';
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

export interface OrphanStubSpec {
  id: string;
  kind: EntityKind;
  /** Best-effort display name from tagged surface text in the corpus. */
  name: string;
}

/** Infer entity kind from a local id prefix (`person-…`, `place-…`, …). */
export function kindFromEntityId(id: string): EntityKind | null {
  const match = /^(person|place|work|office|org|thing)-/i.exec(id);
  if (!match) return null;
  return match[1]!.toLowerCase() as EntityKind;
}

/**
 * Build stub specs for genuine orphan keys: keep the corpus `@key` string and
 * mint a minimal PEDB row (id + primary name from surface text). Authority
 * links cannot be recovered from the corpus alone.
 */
export async function collectOrphanStubSpecs(
  api: EntityDatabaseCheckApi,
  report: OrphanSweepReport,
): Promise<OrphanStubSpec[]> {
  const byId = new Map<string, OrphanStubSpec>();
  for (const file of report.orphanFiles) {
    if (file.orphanKeys.every((key) => byId.has(key))) continue;
    const xml = await api.readFile(file.path);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      const el = node as Element;
      const key = el.getAttribute('key');
      if (key && file.orphanKeys.includes(key) && !byId.has(key)) {
        const kind = TAG_TO_KIND[el.localName] ?? kindFromEntityId(key) ?? ('person' as EntityKind);
        const raw = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        byId.set(key, { id: key, kind, name: raw || key });
      }
      node = walker.nextNode();
    }
    // Keys present in the report but not found as elements (unusual) still get stubs.
    for (const key of file.orphanKeys) {
      if (byId.has(key)) continue;
      byId.set(key, {
        id: key,
        kind: kindFromEntityId(key) ?? 'person',
        name: key,
      });
    }
  }
  return [...byId.values()];
}

/**
 * Mint stub entities for genuine orphan keys so corpus `@key`s resolve again.
 * Does not rewrite corpus XML. Returns how many stubs were created.
 */
export async function reconstituteReportedOrphans(
  store: EntityStore,
  api: EntityDatabaseCheckApi,
  report: OrphanSweepReport,
): Promise<number> {
  if (!(await store.hasSqliteDatabase())) {
    throw new Error(SQLITE_REQUIRED_LOOKUP_MESSAGE);
  }
  const specs = await collectOrphanStubSpecs(api, report);
  let created = 0;
  for (const spec of specs) {
    await store.sqliteCreatePopulated({
      id: spec.id,
      kind: spec.kind,
      description: 'Reconstituted from corpus after missing entity (orphan recovery).',
      names: [{ text: spec.name, isPrimary: true, origin: 'xml', source: 'orphan-reconstitute' }],
    });
    created += 1;
  }
  return created;
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

  console.info('[entity-db-check] showing mismatch prompt', {
    entitiesPath: store.entitiesPath,
    projectFilePath: input.projectFilePath,
    projectDatabaseId: input.projectDatabaseId,
    activeDatabaseId: databaseId,
  });

  const { response } = await api.showNativeMessageBox({
    type: 'warning',
    title: t('LW.entityDatabaseCheck.mismatchTitle'),
    message: t('LW.entityDatabaseCheck.mismatchMessage'),
    detail: t('LW.entityDatabaseCheck.mismatchDetail'),
    buttons: [t('LW.entityDatabaseCheck.cancel'), t('LW.entityDatabaseCheck.purgeKeys')],
    defaultId: 0,
    cancelId: 0,
  });

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
