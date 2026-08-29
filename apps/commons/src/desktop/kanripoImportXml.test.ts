import {
  wrapKanripoTeiDocument,
  uniqueKanripoXmlPath,
  type KanripoTeiMeta,
} from './kanripoImportXml';
import type { ProjectFileConfig } from './projectFile';

const config: ProjectFileConfig = {
  name: 'Test project',
  schema: {
    catalogId: 'teiLite',
    css: 'schema/tei.css',
    rng: 'schema/tei_lite.rng',
  },
  version: 1,
};

const meta: KanripoTeiMeta = {
  title: 'Test Juan',
  kanripo_id: 'KRTEST1',
  juan: '1',
  source: 'WYG',
  dzid: '',
  normalize: 'off',
  stem: 'KRTEST1_001',
};

describe('wrapKanripoTeiDocument', () => {
  test('fills title, Kanripo idno, sourceDesc, pb-ready body, and revisionDesc', () => {
    const xml = wrapKanripoTeiDocument({
      config,
      meta,
      bodyXml:
        '<div type="juan">\n<p>甲<pb n="KRTEST1_WYG_001-1a"/><note type="comm">注</note></p>\n</div>',
      importedAt: new Date('2026-08-27T12:00:00Z'),
    });

    expect(xml).toContain('<title>Test Juan</title>');
    expect(xml).toContain('<idno type="Kanripo">KRTEST1</idno>');
    expect(xml).not.toContain('<bibl><idno type="Kanripo">');
    expect(xml).not.toContain('<title>Test Juan</title><idno');
    expect(xml).toContain('Kanseki Repository (Kanripo)');
    expect(xml).toContain('https://github.com/kanripo/KRTEST1');
    expect(xml).toContain('<div type="juan">');
    expect(xml).toContain('<note type="comm">注</note>');
    expect(xml).toContain('normalisation=off');
    expect(xml).toContain('when="2026-08-27"');
    expect(xml).not.toContain('Paragraph text');
  });

  test('allocates unique xml paths with numeric suffixes', () => {
    const used = new Set<string>();
    const first = uniqueKanripoXmlPath('/proj/imported/kanripo/KR1', 'KR1_001', used);
    const second = uniqueKanripoXmlPath('/proj/imported/kanripo/KR1', 'KR1_001', used);
    expect(first).toBe('/proj/imported/kanripo/KR1/KR1_001.xml');
    expect(second).toBe('/proj/imported/kanripo/KR1/KR1_001-2.xml');
  });

  test('rejects Orlando catalogs', () => {
    expect(() =>
      wrapKanripoTeiDocument({
        config: { ...config, schema: { ...config.schema, catalogId: 'orlando' } },
        meta,
        bodyXml: '<div type="juan"/>',
      }),
    ).toThrow(/TEI/);
  });
});
