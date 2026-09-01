/**
 * Every corpus importer must produce a document that validates against the
 * bundled `cbeta_p5.rng` (`ljb-cbeta-loosen v2`) when the project targets the
 * CBETA P5 catalog. The schema-critical invariants, verified here structurally
 * (and confirmed against the RNG with `xmllint --relaxng` during development):
 *
 *   - the body division is a plain `<div type="…">` (v2 accepts `<div>` and
 *     `<cb:div>` alike) — no double `<div type="juan">` wrapper;
 *   - no `@n` on a body `<div>` (CBETA's `att.global` `@n` pattern rejects a
 *     CJK value and the failure cascades to the `<body>` model);
 *   - no `<ab>` blocks (not in CBETA's `<div>` content model) — folios are `<p>`;
 *   - `xmlns:cb` is declared so native CBETA `<cb:div>` markup resolves;
 *   - composition date is `<date>`, never `<origDate>` (CBETA has no origDate);
 *   - no un-spliced skeleton placeholder text.
 */
import { wrapBdrcTeiDocument } from './bdrcImportXml';
import { wrapCbetaTeiDocument } from './cbetaImportXml';
import { wrapDaozangTeiDocument } from './daozangImportXml';
import { wrapKanripoTeiDocument } from './kanripoImportXml';
import { wrapWikisourceTeiDocument } from './wikisourceImportXml';
import type { ProjectFileConfig } from './projectTypes';

const cbetaConfig: ProjectFileConfig = {
  version: 1,
  name: 'P5 target',
  schema: { rng: 'schema/cbeta_p5.rng', css: 'schema/cbeta.css', catalogId: 'cbeta' },
};

const assertCbetaShape = (xml: string) => {
  expect(xml).toContain('href="schema/cbeta_p5.rng"');
  expect(xml).toContain('xmlns:cb="http://www.cbeta.org/ns/1.0"');
  expect(xml).not.toContain('<origDate>');
  expect(xml).not.toContain('Paragraph text'); // skeleton placeholder spliced out
  expect(xml).not.toContain('Section heading');
  const body = xml.match(/<body>[\s\S]*<\/body>/)?.[0] ?? '';
  expect(body).not.toMatch(/<div[\s>]/); // body divisions are <cb:div>, not TEI <div>
  expect(body).not.toMatch(/<cb:div[^>]*\sn=/); // CBETA divisions reject @n
  expect(body).not.toMatch(/<ab[\s>]/); // <ab> not in CBETA's <cb:div> model
  expect(body).not.toMatch(/<body>\s*<head[\s>]/); // no bare <head> in <body>
};

describe('corpus importers targeting catalogId "cbeta"', () => {
  test('Daozang', () => {
    const xml = wrapDaozangTeiDocument({
      config: cbetaConfig,
      meta: {
        title: '一切道經音義妙門由起',
        dz_no: 'DZ1123',
        variant: 'zhengtong',
        rel_path: 'taiping/foo.txt',
        stem: 'foo',
        source: 'Fang Tongzi Daozang',
        time_dynasty: '唐',
        vols: '1',
      },
      bodyXml: '<div type="juan" n="1"><p>夫道者</p></div>',
    });
    assertCbetaShape(xml);
    expect(xml).toContain('<date>唐</date>');
    expect(xml).toContain('夫道者');
  });

  test('CBETA', () => {
    const xml = wrapCbetaTeiDocument({
      config: cbetaConfig,
      meta: {
        title: '大方廣佛華嚴經',
        work_id: 'T0279',
        canon: 'T',
        juan_n: '1',
        split_unit: 'juan',
        stem: 'T0279',
        source: 'CBETA 漢文電子佛典',
        dynasty: '唐',
      },
      bodyXml:
        '<text xmlns="http://www.tei-c.org/ns/1.0" xmlns:cb="http://www.cbeta.org/ns/1.0">' +
        '<body><milestone unit="juan" n="1"/><p>如是我聞</p></body></text>',
    });
    assertCbetaShape(xml);
    // canon code → <edition> + a dated <imprint> with integer years
    expect(xml).toContain('<edition>大正新脩大藏經 (Taishō Shinshū Daizōkyō)</edition>');
    expect(xml).toContain('<imprint><date from="1924" to="1934">1924–1934</date></imprint>');
  });

  test('Kanripo', () => {
    const xml = wrapKanripoTeiDocument({
      config: cbetaConfig,
      meta: {
        title: '荀子',
        kanripo_id: 'KR3j0001',
        juan: '1',
        stem: 'xunzi',
        source: '',
        normalize: 'nfc',
        time_dynasty: '周',
        authorship: [{ person_name: '荀況', function: '撰' }],
      },
      bodyXml: '<div type="juan"><p>君子曰學不可以已</p></div>',
    });
    assertCbetaShape(xml);
    expect(xml).toContain('<date>周</date>');
    expect(xml).toContain('<author>荀況</author>'); // CBETA <author> takes no @role
  });

  test('Wikisource', () => {
    const xml = wrapWikisourceTeiDocument({
      config: cbetaConfig,
      meta: {
        title: '道德經',
        workTitle: '道德經',
        pageTitle: '道德經',
        url: 'https://zh.wikisource.org/wiki/道德經',
        authors: [{ name: '老子' }],
      },
      bodyXml: '<div type="juan"><p>道可道非常道</p></div>',
    });
    assertCbetaShape(xml);
    expect(xml).toContain('道可道非常道');
  });

  test('BDRC', () => {
    const xml = wrapBdrcTeiDocument({
      config: cbetaConfig,
      headerFields: {
        title: 'A Tibetan etext',
        altTitles: [],
        lang: 'bo',
        creators: [],
        idno: [{ type: 'BDRC', value: 'WA0RK0001' }],
        sourceUri: 'https://library.bdrc.io/show/bdr:WA0RK0001',
        availabilityStatus: 'restricted',
        accessTier: null,
        attribution: null,
        transcriptionMethod: 'ocr',
        reviewNeeded: false,
        provenance: {},
      },
      bodyXml:
        '<div type="section" n="ch1"><head>leʾu 1</head>' +
        '<ab><pb n="1a"/>བོད་ཡིག<lb/>gnyis</ab><ab><pb n="1b"/>more</ab></div>',
    });
    assertCbetaShape(xml);
    expect(xml).toContain('བོད་ཡིག');
    // <ab> folios become <p>; the folio <pb n> stays; TEI <div> becomes <cb:div>.
    expect(xml).toContain('<p><pb n="1a"/>');
    expect(xml).toContain('<cb:div type="section"><head>leʾu 1</head>');
  });
});

describe('BDRC importer: TEI-ALL target keeps <ab> and @n', () => {
  test('non-CBETA body is spliced verbatim', () => {
    const xml = wrapBdrcTeiDocument({
      config: {
        version: 1,
        name: 'TEI-ALL',
        schema: { rng: 'schema/tei_all.rng', css: 'schema/tei.css', catalogId: 'teiAll' },
      },
      headerFields: {
        title: 'A Tibetan etext',
        altTitles: [],
        lang: 'bo',
        creators: [],
        idno: [{ type: 'BDRC', value: 'WA0RK0001' }],
        sourceUri: 'https://library.bdrc.io/show/bdr:WA0RK0001',
        availabilityStatus: 'restricted',
        accessTier: null,
        attribution: null,
        transcriptionMethod: 'ocr',
        reviewNeeded: false,
        provenance: {},
      },
      bodyXml: '<div type="section" n="ch1"><ab><pb n="1a"/>བོད་ཡིག</ab></div>',
    });
    expect(xml).toContain('<div type="section" n="ch1">');
    expect(xml).toContain('<ab><pb n="1a"/>');
  });
});
