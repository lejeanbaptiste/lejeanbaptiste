import { mergeMetadataIntoHeader } from './projectMetadata';
import { getDefaultSaveAsPath, resolveSaveAsDirectory } from './saveAsDefaults';
import {
  buildOrlandoSkeletonXml,
  buildSkeletonForCatalog,
  buildTeiSkeletonXml,
} from './schemaTemplates';
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
  test('teiAll skeleton uses structured publicationStmt placeholder', () => {
    const xml = buildTeiSkeletonXml({
      schema: { catalogId: 'teiAll', rng: 'schema/tei_all.rng', css: 'schema/tei.css' },
    });

    expect(xml).toContain('<publicationStmt><authority/></publicationStmt>');
    expect(xml).not.toContain('<publicationStmt><p/>');
  });

  test('teiAll skeleton uses relative PIs and minimal body', () => {
    const xml = buildTeiSkeletonXml({
      schema: { catalogId: 'teiAll', rng: 'schema/tei_all.rng', css: 'schema/tei.css' },
    });

    expect(xml).toContain('href="schema/tei_all.rng"');
    expect(xml).toContain('href="schema/tei.css"');
    expect(xml).toContain('<title>Untitled</title>');
    expect(xml).toContain('<div type="text">');
    expect(xml).toContain('<head>Section heading</head>');
    expect(xml).toContain('<p>Paragraph text</p>');
  });

  test('teiLite skeleton uses tei_lite.rng path', () => {
    const xml = buildTeiSkeletonXml({
      schema: { catalogId: 'teiLite', rng: 'schema/tei_lite.rng', css: 'schema/tei.css' },
    });

    expect(xml).toContain('href="schema/tei_lite.rng"');
  });

  test('teiSimplePrint skeleton uses tei_simplePrint.rng path', () => {
    const xml = buildTeiSkeletonXml({
      schema: {
        catalogId: 'teiSimplePrint',
        rng: 'schema/tei_simplePrint.rng',
        css: 'schema/tei.css',
      },
    });

    expect(xml).toContain('href="schema/tei_simplePrint.rng"');
  });

  test('jTei skeleton uses tei_jtei.rng path', () => {
    const xml = buildTeiSkeletonXml({
      schema: { catalogId: 'jTei', rng: 'schema/tei_jtei.rng', css: 'schema/tei.css' },
    });

    expect(xml).toContain('href="schema/tei_jtei.rng"');
  });
});

describe('buildOrlandoSkeletonXml', () => {
  test('orlando skeleton uses orlando_entry.rng and minimal ENTRY structure', () => {
    const xml = buildOrlandoSkeletonXml({
      schema: {
        catalogId: 'orlando',
        rng: 'schema/orlando_entry.rng',
        css: 'schema/orlando.css',
      },
    });

    expect(xml).toContain('href="schema/orlando_entry.rng"');
    expect(xml).toContain('<DOCTITLE>Untitled</DOCTITLE>');
    expect(xml).toContain('ID="UNTITL"');
    expect(xml).toContain('<DIV0>');
    expect(xml).toContain('<STANDARD>Author name</STANDARD>');
    expect(xml).toContain('<BIOGRAPHY>');
    expect(xml).toContain('<BIRTH>');
    expect(xml).toContain('<WRITING>');
    expect(xml).toContain('<PRODUCTION>');
  });
});

describe('buildSkeletonForCatalog', () => {
  test('routes orlando to Orlando skeleton', () => {
    const xml = buildSkeletonForCatalog({
      schema: { catalogId: 'orlando', rng: 'schema/orlando_entry.rng', css: 'schema/orlando.css' },
    });
    expect(xml).toContain('<ENTRY ID=');
    expect(xml).toContain('<ORLANDOHEADER>');
  });

  test('routes jTei to jTEI skeleton with article structure', () => {
    const xml = buildSkeletonForCatalog({
      schema: { catalogId: 'jTei', rng: 'schema/tei_jtei.rng', css: 'schema/tei.css' },
    });
    expect(xml).toContain('<front>');
    expect(xml).toContain('type="abstract"');
    expect(xml).toContain('type="bibliography"');
    expect(xml).not.toContain('type="text"');
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

  test('writes licence-only publication metadata with agency placeholder', () => {
    const skeleton = buildTeiSkeletonXml({
      schema: { catalogId: 'teiAll', rng: 'schema/tei_all.rng', css: 'schema/tei.css' },
    });
    const xml = mergeMetadataIntoHeader(skeleton, {
      version: 1,
      catalogId: 'teiAll',
      fields: {
        'publicationStmt/availability/licence': 'CC BY',
      },
      custom: [],
    });

    expect(xml).toContain('<authority/>');
    expect(xml).toContain('<availability><licence>CC BY</licence></availability>');
    expect(xml).not.toContain('<publicationStmt><p');
  });

  test('writes structured TEI publication metadata without the paragraph fallback', () => {
    const skeleton = buildTeiSkeletonXml({
      schema: { catalogId: 'teiLite', rng: 'schema/tei_lite.rng', css: 'schema/tei.css' },
    });
    const xml = mergeMetadataIntoHeader(skeleton, {
      version: 1,
      catalogId: 'teiLite',
      fields: {
        'publicationStmt/availability/licence': 'CC BY',
        'publicationStmt/distributor': 'CNRS',
      },
      custom: [],
    });

    expect(xml).toContain(
      '<publicationStmt><distributor>CNRS</distributor><availability><licence>CC BY</licence></availability></publicationStmt>',
    );
    expect(xml).not.toContain('<publicationStmt><p/>');
  });

  test('returns skeleton unchanged when metadata is empty', () => {
    const skeleton = buildTeiSkeletonXml({
      schema: { catalogId: 'teiLite', rng: 'schema/tei_lite.rng', css: 'schema/tei.css' },
    });
    const empty: ProjectMetadataFile = { version: 1, fields: {}, custom: [] };
    expect(mergeMetadataIntoHeader(skeleton, empty)).toBe(skeleton);
  });

  test('merges Orlando edition metadata into Orlando skeleton', () => {
    const skeleton = buildOrlandoSkeletonXml({
      schema: { catalogId: 'orlando', rng: 'schema/orlando_entry.rng', css: 'schema/orlando.css' },
    });
    const xml = mergeMetadataIntoHeader(skeleton, {
      version: 1,
      catalogId: 'orlando',
      fields: {
        'FILEDESC/PUBLICATIONSTMT/AUTHORITY': 'CWRC',
        'REVISIONDESC/RESPONSIBILITY': 'Test Encoder',
      },
      custom: [],
    });

    expect(xml).toContain('<AUTHORITY>CWRC</AUTHORITY>');
    expect(xml).toContain('RESPONSIBILITY');
    expect(xml).toContain('Test Encoder');
    expect(xml).toContain('<DOCTITLE>Untitled</DOCTITLE>');
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
