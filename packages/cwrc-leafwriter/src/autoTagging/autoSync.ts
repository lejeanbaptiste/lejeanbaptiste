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
import { promoteToCentral } from './promote';
import { readOrMintUserStableId } from './userStableId';
import { findEntity } from './entities';
import { getCentralId } from './concordance';
import { propagateEntityTombstones } from './entityOps';

/**
 * Promote `pedbId` into the central database when this project is set to
 * auto-sync. Idempotent (`promoteToCentral` no-ops if already linked), so
 * callers can call this unconditionally after every create/resolve without
 * needing to know whether the entity was actually new. Desktop-only and
 * best-effort: a missing central folder, no electronAPI (web), or any
 * failure along the way is swallowed - auto-sync must never block the
 * entity creation it's piggybacking on.
 */
export async function autoSyncEntityToCentral(pedbDoc: Document, pedbId: string): Promise<void> {
  return autoSyncEntitiesToCentral(pedbDoc, [pedbId]);
}

/** Propagate central-database deletion tombstones to all linked project copies. */
export async function autoSyncCentralEntityToProjects(
  cedbDoc: Document,
  centralId: string,
): Promise<void> {
  try {
    const api = desktopEntityFileApi();
    if (!api) return;
    const centralFolder = (await window.electronAPI?.getEntityDbFolder?.().catch(() => null)) ?? null;
    const centralStore = centralEntityStoreFromDesktop(centralFolder);
    if (!centralStore) return;
    const { id: userStableId } = await readOrMintUserStableId(api, centralFolder);
    for (const projectRoot of await centralStore.registryProjectRoots()) {
      const projectStore = entityStoreFromDesktop({ projectRoot });
      if (!projectStore || projectStore.entitiesPath === centralStore.entitiesPath) continue;
      const pedbDoc = await projectStore.loadEntities();
      let changed = false;
      for (const item of Array.from(pedbDoc.getElementsByTagName('*'))) {
        if (getCentralId(item, userStableId) !== centralId) continue;
        const centralItem = findEntity(cedbDoc, centralId);
        if (centralItem) changed = propagateEntityTombstones(centralItem, item) || changed;
      }
      if (changed) await projectStore.saveEntities(pedbDoc);
    }
  } catch (error) {
    // Best-effort propagation must not prevent saving the central edit.
    console.error('[auto-sync] failed to propagate central tombstones:', error);
  }
}

/**
 * Bulk form of {@link autoSyncEntityToCentral} - one central-store load/save
 * round trip for every id instead of one per entity. Use this after minting
 * many entities at once (e.g. seed/import auto-linking a whole corpus sweep)
 * rather than calling the single-entity form in a loop.
 */
export async function autoSyncEntitiesToCentral(pedbDoc: Document, pedbIds: string[]): Promise<void> {
  if (pedbIds.length === 0) return;
  const project = (window as unknown as DesktopEntityStoreGlobals).__ljbLspProject;
  if (!project?.syncToCentral) return;

  try {
    const api = desktopEntityFileApi();
    if (!api) return;
    const centralFolder = project.entityDbFolder ?? null;
    const centralStore = centralEntityStoreFromDesktop(centralFolder);
    if (!centralStore) return;

    const { id: userStableId } = await readOrMintUserStableId(api, centralFolder);
    const cedbDoc = await centralStore.loadEntities();
    for (const pedbId of pedbIds) {
      promoteToCentral(pedbDoc, pedbId, cedbDoc, userStableId);
      const pedbItem = findEntity(pedbDoc, pedbId);
      const centralId = pedbItem ? getCentralId(pedbItem, userStableId) : null;
      const centralItem = centralId ? findEntity(cedbDoc, centralId) : null;
      if (pedbItem && centralItem) propagateEntityTombstones(pedbItem, centralItem);
    }
    await centralStore.saveEntities(cedbDoc);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[auto-sync] failed to promote new entities to central database:', error);
  }
}
