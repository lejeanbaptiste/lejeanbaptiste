import { wrapCbetaTeiDocument, type CbetaTeiMeta } from './cbetaImportXml';
import type { ProjectFileConfig } from './projectTypes';

const meta: CbetaTeiMeta = {
  title: '大方廣佛華嚴經',
  work_id: 'T0279',
  canon: 'T',
  juan_n: '1',
  juan_title: '卷第一',
  split_unit: 'juan',
  stem: 'T0279',
  source: 'CBETA 漢文電子佛典 (cbeta-xml-p5)',
  dynasty: '唐',
  category: '華嚴部',
};

// CBETA-family conversion keeps <cb:div> / juan milestones verbatim.
const cbetaBodyXml =
  '<text xmlns="http://www.tei-c.org/ns/1.0" xmlns:cb="http://www.cbeta.org/ns/1.0">' +
  '<body><milestone unit="juan" n="1"/><lb ed="T" n="0001a01"/>' +
  '<cb:div type="other"><head>世主妙嚴品第一</head><p>如是我聞</p></cb:div></body></text>';

// TEI-catalog (cross-family) conversion downgrades to <div>.
const teiBodyXml = '<body><div><head>世主妙嚴品第一</head><p>如是我聞</p></div></body>';

const cbetaConfig: ProjectFileConfig = {
  version: 1,
  name: 'Huayan',
  schema: { rng: 'schema/cbeta_p5.rng', css: 'schema/cbeta.css', catalogId: 'cbeta' },
};

const teiConfig: ProjectFileConfig = {
  version: 1,
  name: 'Huayan',
  schema: { rng: 'schema/tei_all.rng', css: 'schema/tei.css', catalogId: 'teiAll' },
};

describe('wrapCbetaTeiDocument', () => {
  test('CBETA-family import splices juan markup straight into <body> (no TEI <div> wrapper)', () => {
    const xml = wrapCbetaTeiDocument({ config: cbetaConfig, meta, bodyXml: cbetaBodyXml });

    expect(xml).toContain('schema/cbeta_p5.rng');
    expect(xml).toContain('xmlns:cb="http://www.cbeta.org/ns/1.0"');
    expect(xml).toContain('如是我聞');
    // no TEI <div> wrapper, no injected <head> directly in <body>
    expect(xml).not.toContain('<div type="juan"');
    expect(xml).not.toMatch(/<body>\s*<head>/);
    // the placeholder skeleton division is gone
    expect(xml).not.toContain('Paragraph text');
    // CBETA's schema forbids these header blocks — provenance moves to <change>
    expect(xml).not.toContain('<origDate>');
    expect(xml).not.toContain('<keywords>');
    expect(xml).toMatch(
      /<change [^>]*>Imported from CBETA .*Dynasty: 唐\. Classification: 華嚴部\./,
    );
  });

  test('CBETA-family mulu split wraps the slice in <cb:div> with the section title as <head>', () => {
    const sectionMeta: CbetaTeiMeta = {
      ...meta,
      split_unit: 'mulu',
      section_n: '3',
      section_title: '3 支樓迦讖',
      juan_n: undefined,
      juan_title: undefined,
    };
    const bodyXml =
      '<text xmlns="http://www.tei-c.org/ns/1.0" xmlns:cb="http://www.cbeta.org/ns/1.0">' +
      '<body><p xml:id="pT50p0324b1301">支樓迦讖，亦直云支讖，本月支人</p></body></text>';

    const xml = wrapCbetaTeiDocument({ config: cbetaConfig, meta: sectionMeta, bodyXml });

    expect(xml).toMatch(/<body>\s*<cb:div type="其他"><head>3 支樓迦讖<\/head>\s*<p /);
    expect(xml).not.toMatch(/<body>\s*<head>/); // never a bare <head> in <body>
    expect(xml).not.toContain('<div type="section"');
    expect(xml).not.toContain('Paragraph text');
  });

  test('CBETA-family mulu split does not double a <head> the slice already carries', () => {
    const sectionMeta: CbetaTeiMeta = {
      ...meta,
      split_unit: 'mulu',
      section_n: '1',
      section_title: '1 譯經 — 上',
      juan_n: undefined,
      juan_title: undefined,
    };
    const bodyXml =
      '<text xmlns="http://www.tei-c.org/ns/1.0" xmlns:cb="http://www.cbeta.org/ns/1.0">' +
      '<body><head>譯經上</head><list rend="no-marker"><item>攝摩騰一</item></list></body></text>';

    const xml = wrapCbetaTeiDocument({ config: cbetaConfig, meta: sectionMeta, bodyXml });

    const body = xml.slice(xml.indexOf('<body>'), xml.indexOf('</body>'));
    expect(body).toMatch(/<cb:div type="其他"><head[^>]*>譯經上<\/head>/);
    expect(body).not.toContain('1 譯經 — 上');
    expect(body).not.toMatch(/<head[^>]*>[^<]*<\/head>\s*<head/);
  });

  test('<titleStmt>/<monogr> carry the work title, not the juan/section heading', () => {
    const sectionMeta: CbetaTeiMeta = {
      ...meta,
      title: '高僧傳',
      split_unit: 'mulu',
      section_n: '1',
      section_title: '1 譯經',
      juan_n: undefined,
      juan_title: undefined,
    };
    const bodyXml =
      '<text xmlns="http://www.tei-c.org/ns/1.0" xmlns:cb="http://www.cbeta.org/ns/1.0">' +
      '<body><p>如是我聞</p></body></text>';

    const xml = wrapCbetaTeiDocument({ config: cbetaConfig, meta: sectionMeta, bodyXml });
    const header = xml.slice(0, xml.indexOf('</teiHeader>'));

    expect(header).toContain('<title>高僧傳</title>');
    expect(header).not.toContain('1 譯經'); // section heading stays out of the header
    // …but it still labels the body division
    expect(xml.slice(xml.indexOf('<body>'))).toContain('<head>1 譯經</head>');
  });

  test('TEI-catalog import keeps the <div type="juan"> wrapper and structured header', () => {
    const xml = wrapCbetaTeiDocument({ config: teiConfig, meta, bodyXml: teiBodyXml });

    expect(xml).toContain('schema/tei_all.rng');
    expect(xml).toContain('<div type="juan" n="1">');
    expect(xml).toContain('<origDate>唐</origDate>');
    expect(xml).not.toContain('Paragraph text');
  });

  test('fills <edition> and a dated <imprint> from the canon code', () => {
    const xml = wrapCbetaTeiDocument({ config: teiConfig, meta, bodyXml: teiBodyXml });

    expect(xml).toContain('<edition>大正新脩大藏經 (Taishō Shinshū Daizōkyō)</edition>');
    expect(xml).toContain('<imprint><date from="1924" to="1934">1924–1934</date></imprint>');
    // <edition> precedes <imprint> per the TEI monogr content model
    expect(xml.indexOf('<edition>')).toBeLessThan(xml.indexOf('<imprint>'));
    expect(xml).not.toContain('<imprint><date/></imprint>');
  });

  test('fills a single-year <imprint> when the canon has one printing date', () => {
    const xml = wrapCbetaTeiDocument({
      config: teiConfig,
      meta: { ...meta, work_id: 'S0001', canon: 'S' },
      bodyXml: teiBodyXml,
    });

    expect(xml).toContain('<edition>宋藏遺珍 (Song Canon Fragments)</edition>');
    expect(xml).toContain('<imprint><date when="1935">1935</date></imprint>');
  });

  test('leaves the empty <imprint> for a canon with no edition entry', () => {
    const xml = wrapCbetaTeiDocument({
      config: teiConfig,
      meta: { ...meta, work_id: 'A091n…', canon: 'A' },
      bodyXml: teiBodyXml,
    });

    expect(xml).toContain('<imprint><date/></imprint>');
    expect(xml).not.toContain('<edition>');
  });
});
