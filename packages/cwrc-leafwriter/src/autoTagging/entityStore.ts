import { appendRecords, type DecisionRecord } from './decisionLog';
import {
  createEntitiesScaffold,
  isEntityDatabase,
  parseEntities,
  serializeEntities,
} from './entities';
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
  /** Tell the desktop file watcher to ignore the next change at this path (our own write). */
  notifyOwnWrite?: (filePath: string) => Promise<void>;
}

export const LJB_DIR = '.ljb';
export const ENTITIES_FILE = 'entities.xml';
export const DECISIONS_FILE = 'entity-decisions.jsonl';
export const AUTHORITY_CACHE_DIR = 'authority-cache';
export const AI_CACHE_DIR = 'ai-cache';
export const DISAMBIGUATION_PENDING_FILE = 'disambiguation-pending.json';

/** @deprecated Use LJB_DIR */
export const INFRA_DIR = LJB_DIR;

export { resolveEntityStorePaths, type EntityStoreMode, type EntityStorePaths };

export class EntityStore {
  readonly mode: EntityStoreMode;
  readonly entitiesPath: string;
  readonly projectLjbDir: string;
  readonly projectRoot: string;
  readonly decisionsPath: string;
  readonly authorityCacheDir: string;
  readonly aiCacheDir: string;
  readonly disambiguationPendingPath: string;

  constructor(
    private readonly api: EntityFileApi,
    paths: EntityStorePaths,
  ) {
    this.mode = paths.mode;
    this.entitiesPath = paths.entitiesPath;
    this.projectLjbDir = paths.projectLjbDir;
    this.projectRoot = paths.projectRoot;
    this.decisionsPath = joinPath(paths.projectLjbDir, DECISIONS_FILE);
    this.authorityCacheDir = joinPath(paths.projectLjbDir, AUTHORITY_CACHE_DIR);
    this.aiCacheDir = joinPath(paths.projectLjbDir, AI_CACHE_DIR);
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

  /**
   * Load the entity file, creating `entities.xml` from the scaffold on first
   * use. Returns the parsed document.
   */
  async loadEntities(): Promise<Document> {
    const entitiesDir = this.entitiesPath.replace(/[/\\][^/\\]+$/, '');
    await this.api.ensureDirectory(entitiesDir);
    if (!(await this.api.pathExists(this.entitiesPath))) {
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

  /** Write the entity document back to disk. */
  async saveEntities(doc: Document): Promise<void> {
    if (!isEntityDatabase(doc)) {
      throw new Error('Refusing to save: document is not a valid entity database.');
    }
    const entitiesDir = this.entitiesPath.replace(/[/\\][^/\\]+$/, '');
    await this.api.ensureDirectory(entitiesDir);
    await this.api.writeFile(this.entitiesPath, serializeEntities(doc));
    await this.api.notifyOwnWrite?.(this.entitiesPath);
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
}

export interface DesktopEntityStoreGlobals {
  electronAPI?: Partial<EntityFileApi>;
  __ljbLspProject?: {
    projectRoot?: string;
    entityStore?: EntityStoreMode;
    entityDbFolder?: string | null;
  };
}

/**
 * Build an EntityStore from the desktop globals, or null in the web app / when
 * no project is open.
 */
export function entityStoreFromDesktop(): EntityStore | null {
  const globals = window as unknown as DesktopEntityStoreGlobals & {
    electronAPI?: DesktopEntityStoreGlobals['electronAPI'] & {
      statFile?: (filePath: string) => Promise<{ mtimeMs: number }>;
      ignoreFileChange?: (filePath: string, mtimeMs: number) => Promise<void>;
    };
  };
  const rawApi = globals.electronAPI;
  const project = globals.__ljbLspProject;
  const root = project?.projectRoot;
  if (!rawApi?.ensureDirectory || !rawApi.pathExists || !rawApi.readFile || !rawApi.writeFile || !root) {
    return null;
  }

  const api: EntityFileApi = {
    ensureDirectory: (dirPath) => rawApi.ensureDirectory!(dirPath),
    pathExists: (filePath) => rawApi.pathExists!(filePath),
    readFile: (filePath) => rawApi.readFile!(filePath),
    writeFile: (filePath, content) => rawApi.writeFile!(filePath, content),
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

  try {
    const paths = resolveEntityStorePaths({
      projectRoot: root,
      entityStore: project?.entityStore,
      centralFolder: project?.entityDbFolder ?? null,
    });
    return EntityStore.fromPaths(api, paths);
  } catch {
    return null;
  }
}
