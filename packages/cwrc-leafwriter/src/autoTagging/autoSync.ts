/**
 * When a project has "Sync entities to central database" turned on, every
 * entity it creates or resolves should end up promoted into the CEDB
 * immediately - not just the next time the project happens to reopen. This
 * is the single choke point every creation/resolution call site routes
 * through, so the "if syncToCentral, also promote" logic lives in one place
 * even though it's triggered from several call sites (disambiguation,
 * lookup resolution, manual entity fields, import).
 */

import {
  centralEntityStoreFromDesktop,
  desktopEntityFileApi,
  entityStoreFromDesktop,
  type DesktopEntityStoreGlobals,
} from './entityStore';
import { promoteToCentralSqlite, propagateTombstonesToSqlite } from './sqliteBridgeOps';
import { SQLITE_REQUIRED_MESSAGE } from './sqliteRequired';
import { readOrMintUserStableId } from './userStableId';
import { findEntity } from './entities';
import { setCentralMapping } from './concordance';

/**
 * Promote `pedbId` into the central database when this project is set to
 * auto-sync. Idempotent (`promoteToCentralSqlite` no-ops if already linked), so
 * callers can call this unconditionally after every create/resolve without
 * needing to know whether the entity was actually new. Desktop-only and
 * best-effort: a missing central folder, no electronAPI (web), or any
 * failure along the way is swallowed - auto-sync must never block the
 * entity creation it's piggybacking on.
 */
export async function autoSyncEntityToCentral(
  pedbDoc: Document | null,
  pedbId: string,
): Promise<void> {
  return autoSyncEntitiesToCentral(pedbDoc, [pedbId]);
}

/**
 * Bulk form of {@link autoSyncEntityToCentral} - one central-store load/save
 * round trip for every id instead of one per entity. Use this after minting
 * many entities at once (e.g. seed/import auto-linking a whole corpus sweep)
 * rather than calling the single-entity form in a loop.
 *
 * Requires both PEDB and CEDB SQLite. Missing SQLite is logged and skipped —
 * never falls back to DOM promote/`saveEntities`.
 */
export async function autoSyncEntitiesToCentral(
  pedbDoc: Document | null,
  pedbIds: string[],
): Promise<void> {
  if (pedbIds.length === 0) return;
  const project = (window as unknown as DesktopEntityStoreGlobals).__ljbLspProject;
  if (!project?.syncToCentral) return;

  try {
    const api = desktopEntityFileApi();
    if (!api) return;
    const centralFolder = project.entityDbFolder ?? null;
    const centralStore = centralEntityStoreFromDesktop(centralFolder);
    const projectStore = entityStoreFromDesktop();
    if (!centralStore || !projectStore) return;

    const { id: userStableId } = await readOrMintUserStableId(api, centralFolder);

    if (
      !(await projectStore.hasSqliteDatabase()) ||
      !(await centralStore.hasSqliteDatabase()) ||
      !window.electronAPI?.entitySqliteCreatePopulated
    ) {
      // eslint-disable-next-line no-console
      console.error(`[auto-sync] ${SQLITE_REQUIRED_MESSAGE}`);
      return;
    }

    for (const pedbId of pedbIds) {
      const result = await promoteToCentralSqlite(
        projectStore,
        centralStore,
        pedbId,
        userStableId,
      );
      if (!result) continue;
      if (pedbDoc) {
        const pedbItem = findEntity(pedbDoc, pedbId);
        if (pedbItem) setCentralMapping(pedbItem, userStableId, result.centralId);
      }
      await propagateTombstonesToSqlite(
        projectStore,
        pedbId,
        centralStore,
        result.centralId,
      );
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[auto-sync] failed to promote new entities to central database:', error);
  }
}
