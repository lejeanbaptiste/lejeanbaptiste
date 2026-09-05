/**
 * Headless authority backfill for a Central/project entities.sqlite.
 *
 * Same logic as the Database Window “backfill from authorities” job, but
 * without the UI event loop — usable on large catalogues (~tens of thousands).
 *
 * Usage:
 *   node apps/desktop/scripts/backfill-entity-sqlite.mjs \
 *     [/path/to/ljb_test_root-or-entities.sqlite] \
 *     [--packs /path/to/authority-assets] \
 *     [--live-wikidata]
 *
 * Defaults:
 *   database → /Users/daniel/ShareDocs/@Home/ljb_test_root
 *   packs    → ~/Library/Application Support/Grognard/authority-assets
 *   live Wikidata off (pack + concordance only; much faster)
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { refreshCbdbConcordanceSqlite } from '../../../packages/cwrc-leafwriter/src/autoTagging/cbdbConcordance';
import { EntityStore } from '../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import type { AuthorityPackId } from '../../../packages/cwrc-leafwriter/src/autoTagging/packPaths';
import { backfillEntitiesSqlite } from '../../../packages/cwrc-leafwriter/src/autoTagging/sqliteAuthorityBackfill';
import { lookupAuthorityPackRowsByIds, readAuthorityPackFile } from '../src/authorityPacks';
import {
  applyEntitySqliteAuthorityBackfillPatch,
  applyEntitySqliteConcordance,
  attachEntitySqliteAuthority,
  closeEntitySqliteReadRepositories,
  createPopulatedEntitySqlite,
  findEntitySqliteByAuthority,
  getEntitySqlite,
  listEntitySqlitePanelSummaries,
  mergeEntitySqlite,
  setEntitySqliteRomanizedName,
  setEntitySqliteUserDate,
  tombstoneEntitySqliteNames,
} from '../src/entityDbSqlite/readService';

const DEFAULT_DB_ROOT = '/Users/daniel/ShareDocs/@Home/ljb_test_root';
const DEFAULT_PACKS_ROOT = path.join(
  os.homedir(),
  'Library/Application Support/Grognard/authority-assets',
);

const argValue = (flag: string): string | undefined => {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
};

const resolveSqlitePath = (input?: string): { root: string; sqlitePath: string } => {
  const raw = (input ?? DEFAULT_DB_ROOT).trim();
  if (raw.toLowerCase().endsWith('entities.sqlite')) {
    return { root: path.dirname(path.resolve(raw)), sqlitePath: path.resolve(raw) };
  }
  return {
    root: path.resolve(raw),
    sqlitePath: path.resolve(raw, 'entities.sqlite'),
  };
};

const main = async () => {
  const positional = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
  const { root, sqlitePath } = resolveSqlitePath(positional);
  const packsRoot = path.resolve(argValue('--packs') ?? DEFAULT_PACKS_ROOT);
  const liveWikidata = process.argv.includes('--live-wikidata');

  if (!fs.existsSync(sqlitePath)) {
    console.error(`Missing entities.sqlite: ${sqlitePath}`);
    process.exit(1);
  }
  if (!fs.existsSync(path.join(packsRoot, 'authority-packs'))) {
    console.error(`Missing authority-packs under: ${packsRoot}`);
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = `${sqlitePath}.pre-backfill-${stamp}`;
  console.log(`Backing up → ${backupPath}`);
  await fsp.copyFile(sqlitePath, backupPath);
  // Drop stale WAL so we open a clean snapshot (app should be quit).
  for (const suffix of ['-wal', '-shm']) {
    const side = `${sqlitePath}${suffix}`;
    if (fs.existsSync(side) && fs.statSync(side).size === 0) {
      try {
        await fsp.unlink(side);
      } catch {
        // ignore
      }
    }
  }

  const api = {
    ensureDirectory: async (dirPath: string) => {
      await fsp.mkdir(dirPath, { recursive: true });
    },
    pathExists: async (filePath: string) => {
      try {
        await fsp.access(filePath);
        return true;
      } catch {
        return false;
      }
    },
    readFile: (filePath: string) => fsp.readFile(filePath, 'utf8'),
    writeFile: (filePath: string, content: string) => fsp.writeFile(filePath, content, 'utf8'),
    entitySqliteGet: getEntitySqlite,
    entitySqliteListPanelSummaries: listEntitySqlitePanelSummaries,
    entitySqliteApplyAuthorityBackfillPatch: applyEntitySqliteAuthorityBackfillPatch,
    entitySqliteFindByAuthority: findEntitySqliteByAuthority,
    entitySqliteAttachAuthority: attachEntitySqliteAuthority,
    entitySqliteMerge: mergeEntitySqlite,
    entitySqliteCreatePopulated: createPopulatedEntitySqlite,
    entitySqliteTombstoneNames: tombstoneEntitySqliteNames,
    entitySqliteSetUserDate: setEntitySqliteUserDate,
    entitySqliteSetRomanizedName: setEntitySqliteRomanizedName,
    entitySqliteApplyConcordance: applyEntitySqliteConcordance,
  };

  const store = EntityStore.fromPaths(api, {
    mode: 'central',
    entitiesPath: path.join(root, 'entities.xml'),
    projectGrognardDir: root,
    projectRoot: root,
    centralFolder: root,
  });

  const readPackFile = async (packId: AuthorityPackId) => readAuthorityPackFile(packsRoot, packId);

  const lookupPackRowsByIds = async (packId: AuthorityPackId, authorityIds: string[]) =>
    lookupAuthorityPackRowsByIds(packsRoot, packId, authorityIds);

  console.log(`Database: ${sqlitePath}`);
  console.log(`Packs:    ${packsRoot}`);
  console.log(`Live Wikidata: ${liveWikidata ? 'yes' : 'no (pack/concordance only)'}`);

  console.log('Applying CBDB person concordance…');
  const concordance = await refreshCbdbConcordanceSqlite(store, readPackFile);
  if (concordance) {
    console.log(
      `  CBDB concordance: applied=${concordance.applied} already=${concordance.alreadyPresent} ` +
        `rejected=${concordance.rejected} unresolved=${concordance.unresolved} conflicts=${concordance.conflicts.length}`,
    );
  } else {
    console.log('  CBDB concordance pack unavailable (skipped).');
  }

  let lastLog = Date.now();
  const started = Date.now();
  const result = await backfillEntitiesSqlite(store, {
    readPackFile,
    lookupPackRowsByIds,
    expandWikidataWorks: false,
    liveWikidata,
    yieldFn: async () => undefined,
    onProgress: (progress) => {
      const now = Date.now();
      if (now - lastLog < 2000 && progress.done < progress.total) return;
      lastLog = now;
      const label = progress.entityLabel ? ` — ${progress.entityLabel}` : '';
      console.log(`  ${progress.done}/${progress.total}${label}`);
    },
  });

  console.log('Re-applying CBDB concordance…');
  const concordanceAfter = await refreshCbdbConcordanceSqlite(store, readPackFile);
  if (concordanceAfter) {
    console.log(
      `  CBDB concordance: applied=${concordanceAfter.applied} already=${concordanceAfter.alreadyPresent} ` +
        `conflicts=${concordanceAfter.conflicts.length}`,
    );
  }

  const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    JSON.stringify(
      {
        elapsedSec,
        backupPath,
        entitiesScanned: result.entitiesScanned,
        entitiesUpdated: result.entitiesUpdated,
        namesAdded: result.namesAdded,
        skippedNoAuthority: result.skippedNoAuthority,
        bridgeLinksAttached: result.bridgeLinksAttached,
        bridgeDuplicatesMerged: result.bridgeDuplicatesMerged,
        bridgeConflicts: result.bridgeConflicts,
        cancelled: result.cancelled,
      },
      null,
      2,
    ),
  );

  closeEntitySqliteReadRepositories();
};

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  try {
    closeEntitySqliteReadRepositories();
  } catch {
    // ignore
  }
  process.exit(1);
});
