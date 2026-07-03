import type { DecisionRecord } from './decisionLog';
import { parseLog } from './decisionLog';
import { addEntity, findEntity } from './entities';
import { EntityStore, type EntityFileApi } from './entityStore';

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

describe('EntityStore', () => {
  it('creates /.leaf/entities.xml from the scaffold on first load', async () => {
    const fs = new FakeFs();
    const store = new EntityStore(fs, '/proj');
    expect(store.entitiesPath).toBe('/proj/.leaf/entities.xml');

    const doc = await store.loadEntities();
    expect(fs.dirs.has('/proj/.leaf')).toBe(true);
    expect(fs.files.has('/proj/.leaf/entities.xml')).toBe(true);
    expect(doc.getElementsByTagName('listPerson')).toHaveLength(1);
  });

  it('persists added entities across load/save/reload', async () => {
    const fs = new FakeFs();
    const store = new EntityStore(fs, '/proj');
    const doc = await store.loadEntities();
    const { id } = addEntity(doc, 'person', {
      name: '張衡',
      authorityIds: [{ type: 'CBDB', value: '1762' }],
    });
    await store.saveEntities(doc);

    const reloaded = await store.loadEntities(); // file now exists, not re-scaffolded
    expect(findEntity(reloaded, id)?.getElementsByTagName('persName')[0]?.textContent).toBe('張衡');
  });

  it('appends decision records as JSONL, creating then growing the log', async () => {
    const fs = new FakeFs();
    const store = new EntityStore(fs, '/proj');

    await store.appendDecisions([record()]);
    await store.appendDecisions([record({ action: 'rejected' }), record({ action: 'accepted' })]);

    const body = fs.files.get('/proj/.leaf/entity-decisions.jsonl')!;
    expect(parseLog(body)).toHaveLength(3);
  });

  it('uses the platform separator implied by the root', () => {
    const win = new EntityStore(new FakeFs(), 'C:\\proj');
    expect(win.entitiesPath).toBe('C:\\proj\\.leaf\\entities.xml');
  });
});
