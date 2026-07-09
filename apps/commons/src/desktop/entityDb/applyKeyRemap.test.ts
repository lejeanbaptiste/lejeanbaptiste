import { applyKeyRemapToRoots, type KeyRemapFileOps } from './applyKeyRemap';

const makeOps = (files: Record<string, string>, byRoot: Record<string, string[]>) => {
  const writes: Record<string, string> = {};
  const ops: KeyRemapFileOps = {
    listXmlFiles: async (root) => {
      const list = byRoot[root];
      if (!list) throw new Error(`unreadable root: ${root}`);
      return list;
    },
    readFile: async (path) => {
      const content = files[path];
      if (content === undefined) throw new Error(`no such file: ${path}`);
      return content;
    },
    writeFile: async (path, content) => {
      writes[path] = content;
    },
  };
  return { ops, writes };
};

describe('applyKeyRemapToRoots', () => {
  it('rewrites keys across several project roots and reports the summary', async () => {
    const { ops, writes } = makeOps(
      {
        '/a/doc1.xml': '<p><persName key="person-000002">陳卓</persName></p>',
        '/a/doc2.xml': '<p><placeName key="place-000001">建康</placeName></p>',
        '/b/doc3.xml':
          '<p><persName key="person-000002">陳</persName><persName key="person-000002">卓</persName></p>',
      },
      { '/a': ['/a/doc1.xml', '/a/doc2.xml'], '/b': ['/b/doc3.xml'] },
    );

    const summary = await applyKeyRemapToRoots(
      ['/a', '/b'],
      '/central/entities.xml',
      { 'person-000002': 'person-000001' },
      ops,
    );

    expect(summary).toMatchObject({ filesScanned: 3, filesChanged: 2, keysUpdated: 3, errors: [] });
    expect(writes['/a/doc1.xml']).toBe('<p><persName key="person-000001">陳卓</persName></p>');
    expect(writes['/b/doc3.xml']).toBe(
      '<p><persName key="person-000001">陳</persName><persName key="person-000001">卓</persName></p>',
    );
    expect(writes['/a/doc2.xml']).toBeUndefined();
  });

  it('strips keys on delete (null remap)', async () => {
    const { ops, writes } = makeOps(
      { '/a/doc.xml': '<persName key="person-000003" resp="#x">戴若思</persName>' },
      { '/a': ['/a/doc.xml'] },
    );

    const summary = await applyKeyRemapToRoots(
      ['/a'],
      '/central/entities.xml',
      { 'person-000003': null },
      ops,
    );

    expect(summary.keysUpdated).toBe(1);
    expect(writes['/a/doc.xml']).toBe('<persName resp="#x">戴若思</persName>');
  });

  it('skips the entity database file itself', async () => {
    const { ops, writes } = makeOps(
      { '/a/entities.xml': '<person key="person-000001"/>' },
      { '/a': ['/a/entities.xml'] },
    );

    const summary = await applyKeyRemapToRoots(
      ['/a'],
      '/a/entities.xml',
      { 'person-000001': 'person-000002' },
      ops,
    );

    expect(summary.filesScanned).toBe(0);
    expect(writes).toEqual({});
  });

  it('does not process a file twice when roots overlap', async () => {
    const shared = '<persName key="a">甲</persName>';
    let reads = 0;
    const { ops } = makeOps({ '/a/doc.xml': shared }, { '/a': ['/a/doc.xml'], '/A': ['/a/doc.xml'] });
    const countingOps: KeyRemapFileOps = {
      ...ops,
      readFile: async (path) => {
        reads += 1;
        return ops.readFile(path);
      },
    };

    const summary = await applyKeyRemapToRoots(
      ['/a', '/A'],
      '/central/entities.xml',
      { a: 'b' },
      countingOps,
    );

    expect(reads).toBe(1);
    expect(summary.filesScanned).toBe(1);
  });

  it('collects per-file and per-root errors without aborting', async () => {
    const { ops, writes } = makeOps(
      { '/a/good.xml': '<persName key="a">甲</persName>' },
      { '/a': ['/a/missing.xml', '/a/good.xml'] },
    );

    const summary = await applyKeyRemapToRoots(
      ['/gone', '/a'],
      '/central/entities.xml',
      { a: 'b' },
      ops,
    );

    expect(summary.errors).toHaveLength(2);
    expect(summary.filesChanged).toBe(1);
    expect(writes['/a/good.xml']).toBe('<persName key="b">甲</persName>');
  });

  it('is a no-op for an empty remap', async () => {
    const { ops, writes } = makeOps({}, { '/a': ['/a/doc.xml'] });
    const summary = await applyKeyRemapToRoots(['/a'], '/e.xml', {}, ops);
    expect(summary.filesScanned).toBe(0);
    expect(writes).toEqual({});
  });
});
