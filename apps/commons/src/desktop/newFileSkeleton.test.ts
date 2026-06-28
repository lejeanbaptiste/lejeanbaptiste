import { mergeMetadataIntoHeader } from './projectMetadata';
import { getDefaultSaveAsPath, resolveSaveAsDirectory } from './saveAsDefaults';
import { buildTeiSkeletonXml } from './schemaTemplates';
import type { ProjectMetadataFile } from './projectTypes';

const sampleMetadata: ProjectMetadataFile = {
  version: 1,
  catalogId: 'teiLite',
  fields: {
    'titleStmt/principal': 'Test Encoder',
    'publicationStmt/distributor': 'Example Press',
  },
  custom: [{ path: 'encodingDesc/projectDesc/p', label: 'Note', value: 'Custom note' }],
};

describe('buildTeiSkeletonXml', () => {
  test('teiAll skeleton uses relative PIs and minimal body', () => {
    const xml = buildTeiSkeletonXml({
      schema: { catalogId: 'teiAll', rng: 'schema/tei_all.rng', css: 'schema/tei.css' },
    });

    expect(xml).toContain('href="schema/tei_all.rng"');
    expect(xml).toContain('href="schema/tei.css"');
    expect(xml).toContain('<title>Untitled</title>');
    expect(xml).toContain('<div type="text">');
    expect(xml).toContain('<p>&#8203;</p>');
  });

  test('teiLite skeleton uses tei_lite.rng path', () => {
    const xml = buildTeiSkeletonXml({
      schema: { catalogId: 'teiLite', rng: 'schema/tei_lite.rng', css: 'schema/tei.css' },
    });

    expect(xml).toContain('href="schema/tei_lite.rng"');
  });
});

describe('mergeMetadataIntoHeader', () => {
  test('injects managed and custom metadata values', () => {
    const skeleton = buildTeiSkeletonXml({
      schema: { catalogId: 'teiLite', rng: 'schema/tei_lite.rng', css: 'schema/tei.css' },
    });
    const xml = mergeMetadataIntoHeader(skeleton, sampleMetadata);

    expect(xml).toContain('<principal>Test Encoder</principal>');
    expect(xml).toContain('<distributor>Example Press</distributor>');
    expect(xml).toContain('<p>Custom note</p>');
    expect(xml).toContain('<title>Untitled</title>');
  });

  test('returns skeleton unchanged when metadata is empty', () => {
    const skeleton = buildTeiSkeletonXml({
      schema: { catalogId: 'teiLite', rng: 'schema/tei_lite.rng', css: 'schema/tei.css' },
    });
    const empty: ProjectMetadataFile = { version: 1, fields: {}, custom: [] };
    expect(mergeMetadataIntoHeader(skeleton, empty)).toBe(skeleton);
  });
});

describe('saveAsDefaults', () => {
  const root = '/project';

  test('uses explorer folder when a directory is focused', () => {
    const directory = resolveSaveAsDirectory({
      rootPath: root,
      explorerFocusedPath: '/project/chapters',
      explorerFocusedIsDirectory: true,
    });
    expect(directory).toBe('/project/chapters');
  });

  test('uses parent folder when a file is focused in explorer', () => {
    const directory = resolveSaveAsDirectory({
      rootPath: root,
      explorerFocusedPath: '/project/chapters/intro.xml',
      explorerFocusedIsDirectory: false,
    });
    expect(directory).toBe('/project/chapters');
  });

  test('falls back to project root without explorer focus', () => {
    const directory = resolveSaveAsDirectory({
      rootPath: root,
      explorerFocusedPath: null,
      explorerFocusedIsDirectory: false,
    });
    expect(directory).toBe(root);
  });

  test('temp Save As joins filename with explorer directory', () => {
    const path = getDefaultSaveAsPath({
      rootPath: root,
      explorerFocusedPath: '/project/sub',
      explorerFocusedIsDirectory: true,
      filename: 'untitled.xml',
      previousPath: '/tmp/le-jean-baptiste/1/untitled.xml',
      isTempFile: true,
    });
    expect(path).toBe('/project/sub/untitled.xml');
  });
});
