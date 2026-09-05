import { stampProjectDatabase } from './corpusStamp';
import { createEntitiesScaffold, getDatabaseId } from './entities';
import { EntityStore, type EntityFileApi } from './entityStore';
import { resolveEntityStorePaths } from './entityStoreResolve';
import {
  checkEntityDatabaseFingerprint,
  collectOrphanStubSpecs,
  kindFromEntityId,
  purgeEntityKeysInProject,
  purgeReportedOrphans,
  reconstituteReportedOrphans,
  sweepProjectOrphans,
} from './entityDatabaseCheck';
import { SQLITE_REQUIRED_LOOKUP_MESSAGE } from './sqliteRequired';

const makeApi = (
  files: Record<string, string>,
  extras: Partial<EntityFileApi> = {},
): EntityFileApi => ({
  ensureDirectory: async () => undefined,
  pathExists: async (path: string) => path in files,
  readFile: async (path: string) => files[path] ?? '',
  writeFile: async (path: string, content: string) => {
    files[path] = content;
  },
  ...extras,
});

describe('entityDatabaseCheck', () => {
  it('detects fingerprint mismatch via SQLite metadata', async () => {
    const paths = resolveEntityStorePaths({
      projectRoot: '/proj',
      entityStore: 'project',
    });
    const sqlitePath = paths.entitiesPath.replace(/entities\.xml$/i, 'entities.sqlite');
    const files: Record<string, string> = {
      [sqlitePath]: '',
    };
    const api = makeApi(files, {
      entitySqliteDatabaseId: async () => 'new-id',
    });
    const store = EntityStore.fromPaths(api, paths);
    const { databaseId, mismatch } = await checkEntityDatabaseFingerprint(store, {
      projectDatabaseId: 'old-id',
      projectRoot: '/proj',
      projectFilePath: '/proj/jean-baptiste.project.json',
    });
    expect(databaseId).toBe('new-id');
    expect(mismatch).toBe(true);
    expect(
      getDatabaseId(
        new DOMParser().parseFromString(createEntitiesScaffold('x'), 'application/xml'),
      ),
    ).toBe('x');
  });

  it('fails loud when SQLite is missing', async () => {
    const paths = resolveEntityStorePaths({
      projectRoot: '/proj',
      entityStore: 'project',
    });
    const store = EntityStore.fromPaths(makeApi({}), paths);
    await expect(
      checkEntityDatabaseFingerprint(store, {
        projectDatabaseId: 'old-id',
        projectRoot: '/proj',
        projectFilePath: '/proj/jean-baptiste.project.json',
      }),
    ).rejects.toThrow(SQLITE_REQUIRED_LOOKUP_MESSAGE);
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
    expect(files['/proj/entities.xml']).toContain('grognard-entity-database');
  });
});

describe('orphan sweep + classified purge', () => {
  const buildProject = () => {
    const keep = 'person-keep';
    const wrap = (body: string, stamp?: string) => {
      const xml = `<?xml version="1.0"?><TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>c</title></titleStmt><publicationStmt><p>x</p></publicationStmt><sourceDesc><p>x</p></sourceDesc></fileDesc></teiHeader><text><body>${body}</body></text></TEI>`;
      return stamp ? stampProjectDatabase(xml, stamp).xml : xml;
    };
    const paths = resolveEntityStorePaths({ projectRoot: '/proj', entityStore: 'project' });
    const sqlitePath = paths.entitiesPath.replace(/entities\.xml$/i, 'entities.sqlite');
    const files: Record<string, string> = {
      [sqlitePath]: '',
      '/proj/entities.xml': createEntitiesScaffold('pedb-fp'),
      '/proj/good.xml': wrap(
        `<persName key="${keep}">Keep</persName><persName key="person-orphan">Gone</persName>`,
        'pedb-fp',
      ),
      '/proj/stray.xml': wrap('<persName key="person-elsewhere">Other</persName>', 'other-fp'),
    };
    const storeApi = makeApi(files, {
      entitySqliteDatabaseId: async () => 'pedb-fp',
      entitySqliteListIds: async () => [keep],
    });
    const checkApi = {
      listProjectXmlFiles: async () => [
        { name: 'entities.xml', path: '/proj/entities.xml' },
        { name: 'good.xml', path: '/proj/good.xml' },
        { name: 'stray.xml', path: '/proj/stray.xml' },
      ],
      readFile: async (path: string) => files[path] ?? '',
      writeFile: async (path: string, content: string) => {
        files[path] = content;
      },
    };
    const store = EntityStore.fromPaths(storeApi, paths);
    return { store, checkApi, files, keep };
  };

  it('classifies genuine orphans vs stray (misfiled) files', async () => {
    const { store, checkApi } = buildProject();
    const report = await sweepProjectOrphans(store, checkApi, '/proj');
    expect(report.orphanFiles).toEqual([{ path: '/proj/good.xml', orphanKeys: ['person-orphan'] }]);
    expect(report.strayFiles).toEqual([
      { path: '/proj/stray.xml', stamp: 'other-fp', orphanKeys: ['person-elsewhere'] },
    ]);
  });

  it('purges only genuine orphans, never stray files or resolved keys', async () => {
    const { store, checkApi, files, keep } = buildProject();
    const report = await sweepProjectOrphans(store, checkApi, '/proj');
    const purged = await purgeReportedOrphans(checkApi, report);
    expect(purged).toBe(1);
    expect(files['/proj/good.xml']).toContain(`key="${keep}"`); // resolved key kept
    expect(files['/proj/good.xml']).not.toContain('person-orphan'); // orphan stripped
    expect(files['/proj/stray.xml']).toContain('person-elsewhere'); // stray untouched
  });

  it('collects stub specs from genuine orphans only', async () => {
    expect(kindFromEntityId('place-000042')).toBe('place');
    const { store, checkApi } = buildProject();
    const report = await sweepProjectOrphans(store, checkApi, '/proj');
    const specs = await collectOrphanStubSpecs(checkApi, report);
    expect(specs).toEqual([{ id: 'person-orphan', kind: 'person', name: 'Gone' }]);
  });

  it('reconstitutes genuine orphans as stub entities without rewriting corpus keys', async () => {
    const { store, checkApi, files } = buildProject();
    const created: { id: string; kind: string; name: string }[] = [];
    jest.spyOn(store, 'sqliteCreatePopulated').mockImplementation(async (input) => {
      created.push({
        id: input.id,
        kind: input.kind,
        name: input.names?.[0]?.text ?? '',
      });
      return {};
    });
    const report = await sweepProjectOrphans(store, checkApi, '/proj');
    const count = await reconstituteReportedOrphans(store, checkApi, report);
    expect(count).toBe(1);
    expect(created).toEqual([{ id: 'person-orphan', kind: 'person', name: 'Gone' }]);
    expect(files['/proj/good.xml']).toContain('key="person-orphan"');
    expect(files['/proj/stray.xml']).toContain('person-elsewhere');
  });
});
