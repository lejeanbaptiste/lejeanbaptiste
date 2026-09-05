import { addEntity, createEntitiesScaffold, findEntity, parseEntities } from './entities';
import { addEntityName } from './entityOps';
import { setCentralMapping } from './concordance';
import { synchronizeMirroredProject } from './synchronizedMirror';

const fakeStore = (doc: Document) => {
  const files = new Map<string, string>();
  return {
    hasSqliteDatabase: async () => false,
    loadEntities: async () => doc,
    saveEntities: async (next: Document) => {
      doc = next;
    },
    readProjectGrognardFile: async (name: string) => files.get(name) ?? null,
    writeProjectGrognardFile: async (name: string, content: string) => {
      files.set(name, content);
    },
  } as never;
};

describe('synchronized CEDB/PEDB mirror', () => {
  it('reports unavailable without SQLite instead of DOM sync', async () => {
    const central = parseEntities(createEntitiesScaffold('central'));
    const project = parseEntities(createEntitiesScaffold('project'));
    const centralId = addEntity(central, 'person', { name: '孔遺' }).id;
    const projectId = addEntity(project, 'person', { name: '孔遺' }).id;
    setCentralMapping(findEntity(project, projectId)!, 'user-a', centralId);

    const centralStore = fakeStore(central);
    const projectStore = fakeStore(project);
    addEntityName(project, projectId, '世遠', {
      type: 'courtesy',
      origin: 'authority',
      source: 'Norbert',
    });

    const result = await synchronizeMirroredProject(projectStore, centralStore, 'user-a');
    expect(result.unavailable).toBe(true);
    expect(result.uploadedProjectChanges).toBe(0);
    expect(central.getElementsByTagName('persName').length).toBe(1);
  });

  it('does not overwrite either side when SQLite is missing', async () => {
    const central = parseEntities(createEntitiesScaffold('central'));
    const project = parseEntities(createEntitiesScaffold('project'));
    const centralId = addEntity(central, 'person', { name: '孔遺' }).id;
    const projectId = addEntity(project, 'person', { name: '孔遺' }).id;
    setCentralMapping(findEntity(project, projectId)!, 'user-a', centralId);

    const centralStore = fakeStore(central);
    const projectStore = fakeStore(project);
    addEntityName(project, projectId, '世遠', { type: 'variant', origin: 'user' });
    addEntityName(central, centralId, '世遺', { type: 'variant', origin: 'user' });

    const result = await synchronizeMirroredProject(projectStore, centralStore, 'user-a');
    expect(result.unavailable).toBe(true);
    expect(result.conflicts).toEqual([]);
  });
});
