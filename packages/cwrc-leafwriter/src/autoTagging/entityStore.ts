import { appendRecords, type DecisionRecord } from './decisionLog';
import { createEntitiesScaffold, parseEntities, serializeEntities } from './entities';

/**
 * Persistence for the project's `/.leaf/` infrastructure (Phase 3): the entity
 * authority file and the append-only decision log. Kept behind a narrow file
 * API so it is testable without Electron; the desktop app supplies
 * `window.electronAPI` (ensureDirectory/pathExists/readFile/writeFile).
 */
export interface EntityFileApi {
  ensureDirectory: (dirPath: string) => Promise<void>;
  pathExists: (filePath: string) => Promise<boolean>;
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
}

export const INFRA_DIR = '.leaf';
export const ENTITIES_FILE = 'entities.xml';
export const DECISIONS_FILE = 'entity-decisions.jsonl';

/** Join path segments using the separator the root already uses. */
function join(root: string, ...segments: string[]): string {
  const sep = root.includes('\\') && !root.includes('/') ? '\\' : '/';
  const base = root.replace(/[/\\]+$/, '');
  return [base, ...segments].join(sep);
}

export class EntityStore {
  readonly dir: string;
  readonly entitiesPath: string;
  readonly decisionsPath: string;

  constructor(
    private readonly api: EntityFileApi,
    readonly root: string,
  ) {
    this.dir = join(root, INFRA_DIR);
    this.entitiesPath = join(root, INFRA_DIR, ENTITIES_FILE);
    this.decisionsPath = join(root, INFRA_DIR, DECISIONS_FILE);
  }

  /**
   * Load the entity file, creating `/.leaf/entities.xml` from the empty
   * scaffold on first use. Returns the parsed document.
   */
  async loadEntities(): Promise<Document> {
    await this.api.ensureDirectory(this.dir);
    if (!(await this.api.pathExists(this.entitiesPath))) {
      await this.api.writeFile(this.entitiesPath, createEntitiesScaffold());
    }
    return parseEntities(await this.api.readFile(this.entitiesPath));
  }

  /** Write the entity document back to disk. */
  async saveEntities(doc: Document): Promise<void> {
    await this.api.ensureDirectory(this.dir);
    await this.api.writeFile(this.entitiesPath, serializeEntities(doc));
  }

  /** Append decision records to the JSONL log, creating it if needed. */
  async appendDecisions(records: DecisionRecord[]): Promise<void> {
    if (records.length === 0) return;
    await this.api.ensureDirectory(this.dir);
    const existing = (await this.api.pathExists(this.decisionsPath))
      ? await this.api.readFile(this.decisionsPath)
      : '';
    await this.api.writeFile(this.decisionsPath, appendRecords(existing, records));
  }
}

/**
 * Build an EntityStore from the desktop globals, or null in the web app / when
 * no project is open. Mirrors how the crawl reads the project bridge.
 */
export function entityStoreFromDesktop(): EntityStore | null {
  const globals = window as unknown as {
    electronAPI?: Partial<EntityFileApi>;
    __ljbLspProject?: { projectRoot?: string };
  };
  const api = globals.electronAPI;
  const root = globals.__ljbLspProject?.projectRoot;
  if (!api?.ensureDirectory || !api.pathExists || !api.readFile || !api.writeFile || !root) {
    return null;
  }
  return new EntityStore(api as EntityFileApi, root);
}
