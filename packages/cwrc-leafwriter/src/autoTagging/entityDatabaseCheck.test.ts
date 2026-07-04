import { createEntitiesScaffold, getDatabaseId } from './entities';
import { EntityStore } from './entityStore';
import { resolveEntityStorePaths } from './entityStoreResolve';
import { checkEntityDatabaseFingerprint, purgeEntityKeysInProject } from './entityDatabaseCheck';

const makeApi = (files: Record<string, string>) => ({
  ensureDirectory: async () => undefined,
  pathExists: async (path: string) => path in files,
  readFile: async (path: string) => files[path] ?? '',
  writeFile: async (path: string, content: string) => {
    files[path] = content;
  },
});

describe('entityDatabaseCheck', () => {
  it('detects fingerprint mismatch', async () => {
    const paths = resolveEntityStorePaths({
      projectRoot: '/proj',
      entityStore: 'project',
    });
    const api = makeApi({});
    const store = EntityStore.fromPaths(api, paths);
    const { databaseId, mismatch } = await checkEntityDatabaseFingerprint(store, {
      projectDatabaseId: 'old-id',
      projectRoot: '/proj',
      projectFilePath: '/proj/jean-baptiste.project.json',
    });
    expect(databaseId).toBeTruthy();
    expect(mismatch).toBe(true);
    expect(getDatabaseId(new DOMParser().parseFromString(createEntitiesScaffold('x'), 'application/xml'))).toBe('x');
  });

  it('purges keys across project xml files', async () => {
    const files: Record<string, string> = {
      '/proj/doc.xml':
        '<TEI xmlns="http://www.tei-c.org/ns/1.0"><persName key="person-000001">A</persName></TEI>',
      '/proj/entities.xml': createEntitiesScaffold(),
    };
    const api = {
      listProjectXmlFiles: async () => [
        { name: 'doc.xml', path: '/proj/doc.xml' },
        { name: 'entities.xml', path: '/proj/entities.xml' },
      ],
      readFile: async (path: string) => files[path] ?? '',
      writeFile: async (path: string, content: string) => {
        files[path] = content;
      },
    };

    const count = await purgeEntityKeysInProject(api, '/proj');
    expect(count).toBe(1);
    expect(files['/proj/doc.xml']).not.toContain('key=');
    expect(files['/proj/entities.xml']).toContain('ljb-entity-database');
  });
});
