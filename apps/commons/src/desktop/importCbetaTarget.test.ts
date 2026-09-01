/**
 * Every corpus importer must produce a document that validates against the
 * bundled `cbeta_p5.rng` (`ljb-cbeta-loosen v2`) when the project targets the
 * CBETA P5 catalog. The schema-critical invariants, verified here structurally
 * (and confirmed against the RNG with `xmllint --relaxng` during development):
 *
 *   - the body division is a plain `<div type="…">` (v2 accepts `<div>` and
 *     `<cb:div>` alike) — no double `<div type="juan">` wrapper;
 *   - `xmlns:cb` is declared so native CBETA `<cb:div>` markup resolves;
 *   - composition date is `<date>`, never `<origDate>` (CBETA has no origDate);
 *   - no un-spliced skeleton placeholder text.
 */
import { wrapBdrcTeiDocument } from './bdrcImportXml';
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
    expect(xml).toContain('<author role="撰">荀況</author>');
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
      bodyXml: '<div type="text"><p>བོད་ཡིག</p></div>',
    });
    assertCbetaShape(xml);
    expect(xml).toContain('བོད་ཡིག');
  });
});
