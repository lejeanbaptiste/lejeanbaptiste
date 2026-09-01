import type { EntitySummary } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityOps';
import type { EntityStore } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import {
  desktopEntityFileApi,
  entityStoreFromDesktop,
  centralEntityStoreFromDesktop,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import { entitySummaryFromSqlite } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/sqliteSummary';
import { readOrMintUserStableId } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/userStableId';

/**
 * Attach corpus (PEDB) and central (CEDB) keys to summaries for the database viewer.
 */
export const attachProjectCentralKeys = async (
  summaries: EntitySummary[],
  options: {
    viewingCentral: boolean;
    projectStore: EntityStore | null;
    centralFolder: string | null | undefined;
  },
): Promise<EntitySummary[]> => {
  if (summaries.length === 0) return summaries;

  if (!options.viewingCentral) {
    const api = desktopEntityFileApi();
    if (!options.projectStore || !api) {
      return summaries.map((summary) => ({
        ...summary,
        projectKey: summary.projectKey ?? summary.id,
        centralKey: summary.centralKey ?? null,
      }));
    }
    try {
      const { id: userStableId } = await readOrMintUserStableId(api, options.centralFolder ?? null);
      const mappings = await options.projectStore.sqliteListAllCentralMappings(userStableId);
      const byProject = new Map(mappings.map((row) => [row.projectEntityId, row.centralId]));
      return summaries.map((summary) => ({
        ...summary,
        projectKey: summary.id,
        centralKey: byProject.get(summary.id) ?? null,
      }));
    } catch {
      return summaries.map((summary) => ({
        ...summary,
        projectKey: summary.id,
        centralKey: summary.centralKey ?? null,
      }));
    }
  }

  const api = desktopEntityFileApi();
  if (!options.projectStore || !api) {
    return summaries.map((summary) => ({
      ...summary,
      projectKey: summary.projectKey ?? null,
      centralKey: summary.id,
    }));
  }
  try {
    const { id: userStableId } = await readOrMintUserStableId(api, options.centralFolder ?? null);
    const mappings = await options.projectStore.sqliteListAllCentralMappings(userStableId);
    const byCentral = new Map(mappings.map((row) => [row.centralId, row.projectEntityId]));
    return summaries.map((summary) => ({
      ...summary,
      projectKey: byCentral.get(summary.id) ?? null,
      centralKey: summary.id,
    }));
  } catch {
    return summaries.map((summary) => ({
      ...summary,
      projectKey: summary.projectKey ?? null,
      centralKey: summary.id,
    }));
  }
};

export const loadDatabaseWindowEntities = async (
  databaseView: 'project' | 'central',
  syncToCentral: boolean,
): Promise<{
  entities: EntitySummary[];
  projectStore: EntityStore | null;
  centralStore: EntityStore | null;
  activeStore: EntityStore | null;
  error: string | null;
}> => {
  await window.electronAPI?.entityDatabaseEnsure?.().catch(() => undefined);

  const projectStore = entityStoreFromDesktop();
  const centralFolder = (await window.electronAPI?.getEntityDbFolder?.().catch(() => null)) ?? null;
  const centralStore = centralEntityStoreFromDesktop(centralFolder);
  const viewingCentral = Boolean((syncToCentral || databaseView === 'central') && centralStore);
  const activeStore = viewingCentral ? centralStore : projectStore;

  if (!activeStore) {
    if (viewingCentral) {
      return {
        entities: [],
        projectStore,
        centralStore,
        activeStore: null,
        error: centralFolder
          ? 'The central entity database could not be opened.'
          : 'No entity database folder is configured. Choose one in Settings › Profil.',
      };
    }
    return {
      entities: [],
      projectStore,
      centralStore,
      activeStore: null,
      error: 'Open a project to browse its entity database, or switch to Central.',
    };
  }
  if (!(await activeStore.hasSqliteDatabase())) {
    return {
      entities: [],
      projectStore,
      centralStore,
      activeStore,
      error: 'SQLite entity database is required.',
    };
  }

  const snapshots = await activeStore.sqlitePanelSummaries();
  const summaries = await attachProjectCentralKeys(
    (snapshots ?? []).map((snapshot) =>
      entitySummaryFromSqlite(snapshot as Parameters<typeof entitySummaryFromSqlite>[0]),
    ),
    {
      viewingCentral,
      projectStore,
      centralFolder: centralStore?.centralFolder,
    },
  );

  return {
    entities: summaries,
    projectStore,
    centralStore,
    activeStore,
    error: null,
  };
};
