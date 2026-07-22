import { stampProjectDatabase } from './corpusStamp';
import { addEntity, createEntitiesScaffold, getDatabaseId, parseEntities, serializeEntities } from './entities';
import { EntityStore } from './entityStore';
import { resolveEntityStorePaths } from './entityStoreResolve';
import {
  checkEntityDatabaseFingerprint,
  purgeEntityKeysInProject,
  purgeReportedOrphans,
  sweepProjectOrphans,
} from './entityDatabaseCheck';

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

describe('orphan sweep + classified purge', () => {
  const buildProject = () => {
    const pedbDoc = parseEntities(createEntitiesScaffold('pedb-fp'));
    const keep = addEntity(pedbDoc, 'person', { name: 'Keep' }).id;
    const wrap = (body: string, stamp?: string) => {
      const xml = `<?xml version="1.0"?><TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>c</title></titleStmt><publicationStmt><p>x</p></publicationStmt><sourceDesc><p>x</p></sourceDesc></fileDesc></teiHeader><text><body>${body}</body></text></TEI>`;
      return stamp ? stampProjectDatabase(xml, stamp).xml : xml;
    };
    const files: Record<string, string> = {
      '/proj/entities.xml': serializeEntities(pedbDoc),
      '/proj/good.xml': wrap(`<persName key="${keep}">Keep</persName><persName key="person-orphan">Gone</persName>`, 'pedb-fp'),
      '/proj/stray.xml': wrap('<persName key="person-elsewhere">Other</persName>', 'other-fp'),
    };
    const storeApi = {
      ensureDirectory: async () => undefined,
      pathExists: async (path: string) => path in files,
      readFile: async (path: string) => files[path] ?? '',
      writeFile: async (path: string, content: string) => {
        files[path] = content;
      },
    };
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
    const store = EntityStore.fromPaths(
      storeApi,
      resolveEntityStorePaths({ projectRoot: '/proj', entityStore: 'project' }),
    );
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
});
