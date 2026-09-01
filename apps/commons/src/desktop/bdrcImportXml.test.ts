import { wrapBdrcTeiDocument, type BdrcHeaderFields } from './bdrcImportXml';
import type { ProjectFileConfig } from './projectTypes';

const teiAllConfig: ProjectFileConfig = {
  version: 1,
  name: 'TEI-ALL',
  schema: { rng: 'schema/tei_all.rng', css: 'schema/tei.css', catalogId: 'teiAll' },
};

const baseFields = (over: Partial<BdrcHeaderFields> = {}): BdrcHeaderFields => ({
  title: 'A Tibetan etext',
  altTitles: [],
  lang: 'bo',
  creators: [],
  idno: [
    { type: 'URI', value: 'http://purl.bdrc.io/resource/UT0001_I1_0000' },
    { type: 'BDRC', value: 'MW0001' },
  ],
  sourceUri: 'http://purl.bdrc.io/resource/UT0001_I1_0000',
  availabilityStatus: 'free',
  accessTier: 'AccessOpen',
  attribution: 'Courtesy of BDRC',
  transcriptionMethod: 'manual',
  reviewNeeded: false,
  provenance: {},
  ...over,
});

const sourceDescOf = (xml: string): string => xml.match(/<sourceDesc>[\s\S]*?<\/sourceDesc>/)?.[0] ?? '';

describe('BDRC <sourceDesc>', () => {
  test('emits <edition> + an ISO <date> when the instance carries them', () => {
    const xml = wrapBdrcTeiDocument({
      config: teiAllConfig,
      headerFields: baseFields({
        edition: 'པར་གཞི་དང་པོ།',
        editionLang: 'bo',
        editionDate: { when: '1737' },
        publisher: 'sde dge par khang',
        pubPlace: 'sde dge',
      }),
      bodyXml: '<div type="text"><ab><pb n="1a"/>བོད་ཡིག</ab></div>',
    });
    const src = sourceDescOf(xml);
    expect(src).toContain('<edition xml:lang="bo">པར་གཞི་དང་པོ།</edition>');
    expect(src).toContain('<pubPlace>sde dge</pubPlace>');
    expect(src).toContain('<publisher>sde dge par khang</publisher>');
    expect(src).toContain('<date when="1737">1737</date>');
    // TEI monogr-ish order: edition/imprint bits precede the idno list.
    expect(src.indexOf('<edition')).toBeLessThan(src.indexOf('<idno'));
  });

  test('a notBefore/notAfter span becomes a ranged <date>', () => {
    const xml = wrapBdrcTeiDocument({
      config: teiAllConfig,
      headerFields: baseFields({ editionDate: { notBefore: '1800', notAfter: '1899' } }),
      bodyXml: '<div type="text"><ab>x</ab></div>',
    });
    expect(sourceDescOf(xml)).toContain('<date notBefore="1800" notAfter="1899">1800–1899</date>');
  });

  test('omits edition / date elements when the instance has none', () => {
    const xml = wrapBdrcTeiDocument({
      config: teiAllConfig,
      headerFields: baseFields(),
      bodyXml: '<div type="text"><ab>x</ab></div>',
    });
    const src = sourceDescOf(xml);
    expect(src).not.toContain('<edition');
    expect(src).not.toContain('<date');
  });

  test('names BDRC and cites the reader URL it was imported from', () => {
    const readerUrl = 'https://library.bdrc.io/show/bdr:IE0001?openEtext=bdr:VE0001_I1';
    const xml = wrapBdrcTeiDocument({
      config: teiAllConfig,
      headerFields: baseFields({ readerUrl }),
      bodyXml: '<div type="text"><ab>x</ab></div>',
    });
    const src = sourceDescOf(xml);
    expect(src).toContain('Buddhist Digital Resource Center (BDRC)');
    expect(src).toContain(`<ref target="${readerUrl}">${readerUrl}</ref>`);
  });

  test('falls back to the resource purl when no reader URL was pasted', () => {
    const xml = wrapBdrcTeiDocument({
      config: teiAllConfig,
      headerFields: baseFields(),
      bodyXml: '<div type="text"><ab>x</ab></div>',
    });
    expect(sourceDescOf(xml)).toContain(
      '<ref target="http://purl.bdrc.io/resource/UT0001_I1_0000">',
    );
  });
});
