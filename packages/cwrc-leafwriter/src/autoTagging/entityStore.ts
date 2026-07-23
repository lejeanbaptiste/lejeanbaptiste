import { appendRecords, type DecisionRecord } from './decisionLog';
import {
  createEntitiesScaffold,
  getDatabaseId,
  isEntityDatabase,
  parseEntities,
  serializeEntities,
} from './entities';
import {
  makeOrder,
  readAppliedOrderIds,
  readOrders,
  recordOrder,
  writeAppliedOrderIds,
  type EntityOrder,
} from './entityOrders';
import { registerProject, resolveProjectRoots } from './entityProjectRegistry';
import {
  resolveEntityStorePaths,
  type EntityStoreMode,
  type EntityStorePaths,
  type EntityStoreResolveInput,
} from './entityStoreResolve';
import { joinPath } from './pathJoin';

/**
 * Persistence for the entity authority file and per-project hidden infra
 * (`.ljb/` decision log, authority cache, etc.). Kept behind a narrow file API
 * so it is testable without Electron.
 */
export interface EntityFileApi {
  ensureDirectory: (dirPath: string) => Promise<void>;
  pathExists: (filePath: string) => Promise<boolean>;
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  /**
   * Arm the watcher immediately before a write starts, so a slow renderer can't lose
   * the race against the watcher's debounce timer between the write landing on disk
   * and `notifyOwnWrite` confirming it.
   */
  armOwnWrite?: (filePath: string) => Promise<void>;
  /** Tell the desktop file watcher to ignore the next change at this path (our own write). */
  notifyOwnWrite?: (filePath: string) => Promise<void>;
}

export const LJB_DIR = '.ljb';
export const ENTITIES_FILE = 'entities.xml';
export const DECISIONS_FILE = 'entity-decisions.jsonl';
export const AUTHORITY_CACHE_DIR = 'authority-cache';
export const AI_CACHE_DIR = 'ai-cache';
export const AI_DISAMBIGUATION_CACHE_DIR = 'ai-disambiguation-cache';
export const DILA_PLACE_DETAIL_CACHE_DIR = 'dila-place-detail-cache';
export const DISAMBIGUATION_PENDING_FILE = 'disambiguation-pending.json';

/** @deprecated Use LJB_DIR */
export const INFRA_DIR = LJB_DIR;

export { resolveEntityStorePaths, type EntityStoreMode, type EntityStorePaths };

export class EntityStore {
  readonly mode: EntityStoreMode;
  readonly entitiesPath: string;
  readonly projectLjbDir: string;
  readonly projectRoot: string;
  readonly centralFolder: string | null;
  readonly decisionsPath: string;
  readonly authorityCacheDir: string;
  readonly aiCacheDir: string;
  readonly aiDisambiguationCacheDir: string;
  readonly dilaPlaceDetailCacheDir: string;
  readonly disambiguationPendingPath: string;

  constructor(
    private readonly api: EntityFileApi,
    paths: EntityStorePaths,
  ) {
    this.mode = paths.mode;
    this.entitiesPath = paths.entitiesPath;
    this.projectLjbDir = paths.projectLjbDir;
    this.projectRoot = paths.projectRoot;
    this.centralFolder = paths.centralFolder;
    this.decisionsPath = joinPath(paths.projectLjbDir, DECISIONS_FILE);
    this.authorityCacheDir = joinPath(paths.projectLjbDir, AUTHORITY_CACHE_DIR);
    this.aiCacheDir = joinPath(paths.projectLjbDir, AI_CACHE_DIR);
    this.aiDisambiguationCacheDir = joinPath(paths.projectLjbDir, AI_DISAMBIGUATION_CACHE_DIR);
    this.dilaPlaceDetailCacheDir = joinPath(paths.projectLjbDir, DILA_PLACE_DETAIL_CACHE_DIR);
    this.disambiguationPendingPath = joinPath(
      paths.projectLjbDir,
      DISAMBIGUATION_PENDING_FILE,
    );
  }

  static fromPaths(api: EntityFileApi, paths: EntityStorePaths): EntityStore {
    return new EntityStore(api, paths);
  }

  static resolve(input: EntityStoreResolveInput): EntityStorePaths {
    return resolveEntityStorePaths(input);
  }

  private pathsMatch(a: string, b: string): boolean {
    const normalize = (value: string) =>
      value.split(/[/\\]+/).filter(Boolean).join('/').toLowerCase();
    return normalize(a) === normalize(b);
  }

  /** Central mode must not write the default project-local slot unless that IS the central folder. */
  private assertEntitiesPathForMode(): void {
    if (this.mode !== 'central') return;

    const projectLocalPath = joinPath(this.projectRoot, ENTITIES_FILE);
    if (!this.pathsMatch(this.entitiesPath, projectLocalPath)) return;

    if (this.centralFolder && this.pathsMatch(this.centralFolder, this.projectRoot)) return;

    throw new Error(
      'Central entity database must not use a project-local entities.xml file when the central folder is elsewhere.',
    );
  }

  /**
   * Load the entity file, creating `entities.xml` from the scaffold on first
   * use. Returns the parsed document.
   *
   * `pathExists` returning false is treated as "genuinely missing, safe to
   * scaffold" - but a synced/network/cloud folder (exactly what the central
   * database commonly lives in) can report false transiently while still
   * mounting, and a scaffolded empty file here gets silently overwritten
   * back onto disk by the next `saveEntities` call, destroying whatever was
   * really there. A single false reading is not enough evidence of "missing"
   * to justify that - retry briefly before concluding it's real.
   */
  async loadEntities(): Promise<Document> {
    this.assertEntitiesPathForMode();
    const entitiesDir = this.entitiesPath.replace(/[/\\][^/\\]+$/, '');
    await this.api.ensureDirectory(entitiesDir);
    if (!(await this.existsWithRetry(this.entitiesPath))) {
      await this.api.armOwnWrite?.(this.entitiesPath);
      await this.api.writeFile(this.entitiesPath, createEntitiesScaffold());
      await this.api.notifyOwnWrite?.(this.entitiesPath);
    }
    const xml = await this.api.readFile(this.entitiesPath);
    const doc = parseEntities(xml);
    if (!isEntityDatabase(doc)) {
      throw new Error(`Not an entity database file: ${this.entitiesPath}`);
    }
    return doc;
  }

  private async existsWithRetry(filePath: string): Promise<boolean> {
    if (await this.api.pathExists(filePath)) return true;
    const delays = [200, 500, 1000, 2000];
    for (const delay of delays) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (await this.api.pathExists(filePath)) return true;
    }
    return false;
  }

  /** Write the entity document back to disk. */
  async saveEntities(doc: Document): Promise<void> {
    this.assertEntitiesPathForMode();
    if (!isEntityDatabase(doc)) {
      throw new Error('Refusing to save: document is not a valid entity database.');
    }
    const entitiesDir = this.entitiesPath.replace(/[/\\][^/\\]+$/, '');
    await this.api.ensureDirectory(entitiesDir);
    await this.api.armOwnWrite?.(this.entitiesPath);
    await this.api.writeFile(this.entitiesPath, serializeEntities(doc));
    await this.api.notifyOwnWrite?.(this.entitiesPath);
  }

  /** Check this project into the shared-database registry (entity-projects.json). */
  async registerProjectInRegistry(): Promise<string[]> {
    return registerProject(this.api, this.entitiesPath, this.projectRoot);
  }

  /** Registered project roots that still exist, always including this project. */
  async registryProjectRoots(): Promise<string[]> {
    return resolveProjectRoots(this.api, this.entitiesPath, this.projectRoot);
  }

  /**
   * Record a merge/delete as a durable order beside `entities.xml`, so projects
   * not reachable right now converge on their next open (see `entityOrders.ts`).
   * `dbId` defaults to the attached database's fingerprint; pass it when the doc
   * is already loaded to avoid a re-read.
   */
  async recordEntityOrder(
    remap: Record<string, string | null>,
    dbId?: string,
  ): Promise<EntityOrder | null> {
    if (Object.keys(remap).length === 0) return null;
    const fingerprint = dbId ?? getDatabaseId(await this.loadEntities());
    if (!fingerprint) return null;
    const order = makeOrder(fingerprint, remap);
    await recordOrder(this.api, this.entitiesPath, order);
    return order;
  }

  /** All recorded orders in the log beside `entities.xml`. */
  async readEntityOrders(): Promise<EntityOrder[]> {
    return readOrders(this.api, this.entitiesPath);
  }

  /** Order ids this project checkout has already applied. */
  async readAppliedOrderIds(): Promise<Set<string>> {
    return readAppliedOrderIds(this.api, this.projectLjbDir);
  }

  /** Persist the applied-order-id set for this project checkout. */
  async writeAppliedOrderIds(applied: Set<string>): Promise<void> {
    await writeAppliedOrderIds(this.api, this.projectLjbDir, applied);
  }

  /** Append decision records to the JSONL log, creating it if needed. */
  async appendDecisions(records: DecisionRecord[]): Promise<void> {
    if (records.length === 0) return;
    await this.api.ensureDirectory(this.projectLjbDir);
    const existing = (await this.api.pathExists(this.decisionsPath))
      ? await this.api.readFile(this.decisionsPath)
      : '';
    await this.api.writeFile(this.decisionsPath, appendRecords(existing, records));
  }

  async readDisambiguationPending(): Promise<string | null> {
    if (!(await this.api.pathExists(this.disambiguationPendingPath))) return null;
    return this.api.readFile(this.disambiguationPendingPath);
  }

  async writeDisambiguationPending(content: string): Promise<void> {
    await this.api.ensureDirectory(this.projectLjbDir);
    await this.api.writeFile(this.disambiguationPendingPath, content);
  }

  projectLjbFilePath(relativeName: string): string {
    return joinPath(this.projectLjbDir, relativeName);
  }

  async readProjectLjbFile(relativeName: string): Promise<string | null> {
    const path = this.projectLjbFilePath(relativeName);
    if (!(await this.api.pathExists(path))) return null;
    return this.api.readFile(path);
  }

  async writeProjectLjbFile(relativeName: string, content: string): Promise<void> {
    await this.api.ensureDirectory(this.projectLjbDir);
    const path = this.projectLjbFilePath(relativeName);
    await this.api.armOwnWrite?.(path);
    await this.api.writeFile(path, content);
    await this.api.notifyOwnWrite?.(path);
  }
}

export interface DesktopEntityStoreGlobals {
  electronAPI?: Partial<EntityFileApi>;
  __ljbLspProject?: {
    projectRoot?: string;
    entityDbFolder?: string | null;
    /** When true, this project's PEDB is auto-synced with the CEDB. */
    syncToCentral?: boolean;
  };
}

type DesktopGlobals = DesktopEntityStoreGlobals & {
  electronAPI?: DesktopEntityStoreGlobals['electronAPI'] & {
    statFile?: (filePath: string) => Promise<{ mtimeMs: number }>;
    ignoreFileChange?: (filePath: string, mtimeMs: number) => Promise<void>;
    armFileWrite?: (filePath: string) => Promise<void>;
  };
};

/** Build the desktop-backed EntityFileApi, or null when the bridge is missing. */
export function desktopEntityFileApi(): EntityFileApi | null {
  const rawApi = (window as unknown as DesktopGlobals).electronAPI;
  if (!rawApi?.ensureDirectory || !rawApi.pathExists || !rawApi.readFile || !rawApi.writeFile) {
    return null;
  }
  return {
    ensureDirectory: (dirPath) => rawApi.ensureDirectory!(dirPath),
    pathExists: (filePath) => rawApi.pathExists!(filePath),
    readFile: (filePath) => rawApi.readFile!(filePath),
    writeFile: (filePath, content) => rawApi.writeFile!(filePath, content),
    armOwnWrite: async (filePath) => {
      if (!rawApi.armFileWrite) return;
      try {
        await rawApi.armFileWrite(filePath);
      } catch {
        // ignore — worst case is the old post-write-only race, not a hard failure
      }
    },
    notifyOwnWrite: async (filePath) => {
      if (!rawApi.statFile || !rawApi.ignoreFileChange) return;
      try {
        const { mtimeMs } = await rawApi.statFile(filePath);
        await rawApi.ignoreFileChange(filePath, mtimeMs);
      } catch {
        // ignore — watcher may still fire, but disambiguation must not fail
      }
    },
  };
}

/**
 * Build an EntityStore from the desktop globals, or null in the web app / when
 * no project is open.
 */
export function entityStoreFromDesktop(): EntityStore | null {
  const api = desktopEntityFileApi();
  const project = (window as unknown as DesktopGlobals).__ljbLspProject;
  const root = project?.projectRoot;
  if (!api || !root) return null;
  try {
    const paths = resolveEntityStorePaths({
      projectRoot: root,
      centralFolder: project?.entityDbFolder ?? null,
    });
    return EntityStore.fromPaths(api, paths);
  } catch {
    return null;
  }
}

/**
 * Build a **central-mode** EntityStore (the user's personal CEDB), regardless of
 * what store the project itself uses — the second half the Bridge needs.
 * Returns null when no central folder is configured.
 */
export function centralEntityStoreFromDesktop(centralFolder: string | null): EntityStore | null {
  const api = desktopEntityFileApi();
  const project = (window as unknown as DesktopGlobals).__ljbLspProject;
  const root = project?.projectRoot;
  const folder = centralFolder ?? project?.entityDbFolder ?? null;
  if (!api || !root || !folder) return null;
  try {
    const paths = resolveEntityStorePaths({
      projectRoot: root,
      entityStore: 'central',
      centralFolder: folder,
    });
    return EntityStore.fromPaths(api, paths);
  } catch {
    return null;
  }
}
