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
    expect(xml).toContain('<biblStruct>');
    expect(xml).toContain('<idno type="Kanripo">KRTEST1</idno>');
    expect(xml).not.toContain('<sourceDesc><p>');
    expect(xml).not.toContain('<title>Test Juan</title><idno');
    expect(xml).toContain('Kanseki Repository (Kanripo)');
    expect(xml).toContain('https://github.com/kanripo/KRTEST1');
    expect(xml).toContain('<div type="juan">');
    expect(xml).toContain('<note type="comm">注</note>');
    expect(xml).toContain('normalisation=off');
    expect(xml).toContain('when="2026-08-27"');
    expect(xml).not.toContain('Paragraph text');
    expect(xml).not.toContain('<metadata');
  });

  test('places extent in fileDesc and author dates in profileDesc/creation/date', () => {
    const xml = wrapKanripoTeiDocument({
      config,
      meta: {
        ...meta,
        vols: '11',
        time_dynasty: '周',
        date_not_before: '-507',
        date_not_after: '-400',
        work_qid: 'Q18835058',
        edition_qid: 'Q28350842',
        ws_url: 'https://zh.wikisource.org/wiki/test',
        authorship: [{ person_name: '卜商', function: '撰' }],
      },
      bodyXml: '<div type="juan"><p>正文</p></div>',
      metadataXml: '<metadata><citation kr_id="KRTEST1" title="Test"/></metadata>',
    });

    expect(xml).toContain('<extent>11 卷</extent>');
    expect(xml).toContain('<title ref="https://www.wikidata.org/entity/Q18835058">');
    expect(xml).not.toContain('<profileDesc>\n      <extent>');
    expect(xml).toContain('<date>周</date>');
    expect(xml).toContain('notBefore="-0507"');
    expect(xml).toContain('notAfter="-0400"');
    expect(xml).not.toContain('<note type="authorDates">');
    expect(xml).toContain('<idno type="URI" subtype="wikisource">');
    expect(xml).not.toContain('<metadata');
    expect(xml).toContain('<author role="撰">卜商</author>');
    const monogr = xml.match(/<monogr>[\s\S]*?<\/monogr>/)?.[0] ?? '';
    expect(monogr.indexOf('<author role="撰">卜商</author>')).toBeLessThan(
      monogr.indexOf('>Test Juan</title>'),
    );
    expect(monogr.indexOf('>Test Juan</title>')).toBeLessThan(
      monogr.indexOf('<idno type="Kanripo">KRTEST1</idno>'),
    );
  });

  test('writes edition label and imprint date in biblStruct', () => {
    const xml = wrapKanripoTeiDocument({
      config,
      meta: {
        ...meta,
        edition_label: '文淵閣四庫全書',
        edition_date: '1782',
        source_locator: 'V143.1, p1 - V144.1',
        catalog_source: '四庫全書 文淵閣版, V143.1, p1 - V144.1',
      },
      bodyXml: '<div type="juan"><p>正文</p></div>',
    });

    expect(xml).toContain('<edition>文淵閣四庫全書</edition>');
    expect(xml).toContain('<date when="1782">1782</date>');
    expect(xml).toContain('locator V143.1, p1 - V144.1');
    expect(xml).not.toContain('catalog 四庫全書');
  });

  test('writes Wikidata authority refs on title and authors', () => {
    const xml = wrapKanripoTeiDocument({
      config,
      meta: {
        ...meta,
        work_qid: 'Q18879076',
        authorship: [
          { person_name: '鄭玄', function: '撰', wikidata_qid: 'Q197649' },
          { person_name: '王應麟', function: '編', wikidata_qid: 'Q5365469' },
        ],
      },
      bodyXml: '<div type="juan"><p>正文</p></div>',
    });

    expect(xml).toContain('<title ref="https://www.wikidata.org/entity/Q18879076">');
    expect(xml).toContain(
      '<author ref="https://www.wikidata.org/entity/Q197649" role="撰">鄭玄</author>',
    );
    expect(xml).toContain(
      '<author ref="https://www.wikidata.org/entity/Q5365469" role="編">王應麟</author>',
    );
  });

  test('zero-pads short CE years in creation/date attributes', () => {
    const xml = wrapKanripoTeiDocument({
      config,
      meta: {
        ...meta,
        date_not_before: '127',
        date_not_after: '200',
      },
      bodyXml: '<div type="juan"><p>正文</p></div>',
    });

    expect(xml).toContain('notBefore="0127"');
    expect(xml).toContain('notAfter="0200"');
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
