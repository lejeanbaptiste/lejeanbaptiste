import type { DecisionRecord } from './decisionLog';
import { parseLog } from './decisionLog';
import { addEntity, findEntity, getDatabaseId } from './entities';
import { EntityStore, type EntityFileApi } from './entityStore';
import { resolveEntityStorePaths } from './entityStoreResolve';

/** In-memory fake of the desktop file API. */
class FakeFs implements EntityFileApi {
  files = new Map<string, string>();
  dirs = new Set<string>();
  ensureDirectory = async (dir: string) => {
    this.dirs.add(dir);
  };
  pathExists = async (path: string) => this.files.has(path);
  readFile = async (path: string) => {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`no such file: ${path}`);
    return content;
  };
  writeFile = async (path: string, content: string) => {
    this.files.set(path, content);
  };
}

const record = (over: Partial<DecisionRecord> = {}): DecisionRecord => ({
  when: '2026-07-03T00:00:00Z',
  documentId: 'a.xml',
  surface: '張衡',
  tag: 'persName',
  action: 'accepted',
  source: 'dictionary',
  scope: 'occurrence',
  ...over,
});

describe('resolveEntityStorePaths', () => {
  it('resolves central mode to configured folder', () => {
    const paths = resolveEntityStorePaths({
      projectRoot: '/proj',
      entityStore: 'central',
      centralFolder: '/corpus',
    });
    expect(paths.entitiesPath).toBe('/corpus/entities.xml');
    expect(paths.projectLjbDir).toBe('/proj/.ljb');
    expect(paths.mode).toBe('central');
  });

  it('resolves project mode to project root entities.xml', () => {
    const paths = resolveEntityStorePaths({
      projectRoot: '/proj',
      entityStore: 'project',
    });
    expect(paths.entitiesPath).toBe('/proj/entities.xml');
    expect(paths.projectLjbDir).toBe('/proj/.ljb');
  });
});

describe('EntityStore', () => {
  const projectPaths = () =>
    resolveEntityStorePaths({
      projectRoot: '/proj',
      entityStore: 'project',
    });

  it('creates entities.xml from the scaffold on first load (project mode)', async () => {
    const fs = new FakeFs();
    const store = EntityStore.fromPaths(fs, projectPaths());
    expect(store.entitiesPath).toBe('/proj/entities.xml');

    const doc = await store.loadEntities();
    expect(fs.files.has('/proj/entities.xml')).toBe(true);
    expect(doc.getElementsByTagName('listPerson')).toHaveLength(1);
    expect(getDatabaseId(doc)).toBeTruthy();
  });

  it('persists added entities across load/save/reload', async () => {
    const fs = new FakeFs();
    const store = EntityStore.fromPaths(fs, projectPaths());
    const doc = await store.loadEntities();
    const { id } = addEntity(doc, 'person', {
      name: '張衡',
      authorityIds: [{ type: 'CBDB', value: '1762' }],
    });
    await store.saveEntities(doc);

    const reloaded = await store.loadEntities();
    expect(findEntity(reloaded, id)?.getElementsByTagName('persName')[0]?.textContent).toBe('張衡');
  });

  it('appends decision records under .ljb/', async () => {
    const fs = new FakeFs();
    const store = EntityStore.fromPaths(fs, projectPaths());

    await store.appendDecisions([record()]);
    await store.appendDecisions([record({ action: 'rejected' }), record({ action: 'accepted' })]);

    const body = fs.files.get('/proj/.ljb/entity-decisions.jsonl')!;
    expect(parseLog(body)).toHaveLength(3);
  });

  it('uses the platform separator implied by the root', () => {
    const paths = resolveEntityStorePaths({
      projectRoot: 'C:\\proj',
      entityStore: 'project',
    });
    const win = EntityStore.fromPaths(new FakeFs(), paths);
    expect(win.entitiesPath).toBe('C:\\proj\\entities.xml');
    expect(win.decisionsPath).toBe('C:\\proj\\.ljb\\entity-decisions.jsonl');
  });
});
