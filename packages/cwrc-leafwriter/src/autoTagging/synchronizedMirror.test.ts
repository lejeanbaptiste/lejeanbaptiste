import { addEntity, createEntitiesScaffold, findEntity, parseEntities } from './entities';
import { addEntityName } from './entityOps';
import { setCentralMapping } from './concordance';
import { synchronizeMirroredProject } from './synchronizedMirror';

const fakeStore = (doc: Document) => {
  const files = new Map<string, string>();
  return {
    loadEntities: async () => doc,
    saveEntities: async (next: Document) => {
      doc = next;
    },
    readProjectLjbFile: async (name: string) => files.get(name) ?? null,
    writeProjectLjbFile: async (name: string, content: string) => {
      files.set(name, content);
    },
  } as never;
};

describe('synchronized CEDB/PEDB mirror', () => {
  it('uploads an offline PEDB change when CEDB is unchanged', async () => {
    const central = parseEntities(createEntitiesScaffold('central'));
    const project = parseEntities(createEntitiesScaffold('project'));
    const centralId = addEntity(central, 'person', { name: '孔遺' }).id;
    const projectId = addEntity(project, 'person', { name: '孔遺' }).id;
    setCentralMapping(findEntity(project, projectId)!, 'user-a', centralId);

    const centralStore = fakeStore(central);
    const projectStore = fakeStore(project);
    await synchronizeMirroredProject(projectStore, centralStore, 'user-a');

    addEntityName(project, projectId, '世遠', { type: 'courtesy', origin: 'authority', source: 'Norbert' });
    const result = await synchronizeMirroredProject(projectStore, centralStore, 'user-a');

    expect(result.uploadedProjectChanges).toBe(1);
    expect(central.getElementsByTagName('persName').length).toBe(2);
  });

  it('reports simultaneous edits instead of overwriting either side', async () => {
    const central = parseEntities(createEntitiesScaffold('central'));
    const project = parseEntities(createEntitiesScaffold('project'));
    const centralId = addEntity(central, 'person', { name: '孔遺' }).id;
    const projectId = addEntity(project, 'person', { name: '孔遺' }).id;
    setCentralMapping(findEntity(project, projectId)!, 'user-a', centralId);

    const centralStore = fakeStore(central);
    const projectStore = fakeStore(project);
    await synchronizeMirroredProject(projectStore, centralStore, 'user-a');
    addEntityName(project, projectId, '世遠', { type: 'variant', origin: 'user' });
    addEntityName(central, centralId, '世遺', { type: 'variant', origin: 'user' });

    const result = await synchronizeMirroredProject(projectStore, centralStore, 'user-a');
    expect(result.conflicts).toEqual([
      { pedbId: projectId, centralId, reason: 'both-sides-changed' },
    ]);
  });
});
