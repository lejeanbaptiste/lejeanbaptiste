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

  test('TEI-catalog import keeps the <div type="juan"> wrapper and structured header', () => {
    const xml = wrapCbetaTeiDocument({ config: teiConfig, meta, bodyXml: teiBodyXml });

    expect(xml).toContain('schema/tei_all.rng');
    expect(xml).toContain('<div type="juan" n="1">');
    expect(xml).toContain('<origDate>唐</origDate>');
    expect(xml).not.toContain('Paragraph text');
  });
});
