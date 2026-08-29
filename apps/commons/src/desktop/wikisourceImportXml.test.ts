import { uniqueWikisourceXmlPath, wrapWikisourceTeiDocument } from './wikisourceImportXml';
import type { ProjectFileConfig } from './projectTypes';

const config: ProjectFileConfig = {
  name: 'Test project',
  schema: {
    catalogId: 'teiLite',
    css: 'schema/tei.css',
    rng: 'schema/tei_lite.rng',
  },
  version: 1,
};

describe('wrapWikisourceTeiDocument', () => {
  test('fills Wikidata idno, authors, and extraction note', () => {
    const xml = wrapWikisourceTeiDocument({
      config,
      meta: {
        title: '荀子',
        workTitle: '荀子',
        pageTitle: '荀子/勸學篇',
        url: 'https://zh.wikisource.org/wiki/荀子/勸學篇',
        qid: 'Q6722310',
        ctextWorkId: 'ctp:work:xunzi',
        authors: [{ qid: 'Q216072', name: '荀子' }],
        headerCredit: '荀子 撰',
        extractionNote: 'No page breaks recovered from wikitext.',
      },
      bodyXml: '<p>學不可以已<note type="comm">注</note></p>',
      importedAt: new Date('2026-08-29T12:00:00Z'),
    });

    expect(xml).toContain('<title>荀子</title>');
    expect(xml).toContain('<author n="Q216072">荀子</author>');
    expect(xml).toContain('https://www.wikidata.org/entity/Q6722310');
    expect(xml).toContain('<idno type="CTP">ctp:work:xunzi</idno>');
    expect(xml).toContain('type="wikisource-header"');
    expect(xml).toContain('No page breaks recovered');
    expect(xml).toContain('<head>荀子/勸學篇</head>');
  });

  test('rejects Orlando projects', () => {
    expect(() =>
      wrapWikisourceTeiDocument({
        config: { ...config, schema: { ...config.schema, catalogId: 'orlando' } },
        meta: {
          title: 'X',
          workTitle: 'X',
          pageTitle: 'X',
          url: 'https://en.wikisource.org/wiki/X',
          authors: [],
        },
        bodyXml: '<p>x</p>',
      }),
    ).toThrow(/Orlando/);
  });
});

describe('uniqueWikisourceXmlPath', () => {
  test('suffixes colliding stems', () => {
    const used = new Set<string>();
    expect(uniqueWikisourceXmlPath('imported/wikisource/荀子', '勸學篇', used)).toBe(
      'imported/wikisource/荀子/勸學篇.xml',
    );
    expect(uniqueWikisourceXmlPath('imported/wikisource/荀子', '勸學篇', used)).toBe(
      'imported/wikisource/荀子/勸學篇-2.xml',
    );
  });
});
