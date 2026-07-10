import { jsonLdToRdfXml } from './jsonLdToRdfXml';

const annotation = {
  '@context': {
    'dcterms:created': { '@id': 'dcterms:created', '@type': 'xsd:dateTime' },
    'oa:motivatedBy': { '@type': 'oa:Motivation' },
    '@language': 'en',
    dc: 'http://purl.org/dc/elements/1.1/',
    dcterms: 'http://purl.org/dc/terms/',
    oa: 'http://www.w3.org/ns/oa#',
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
  },
  id: 'https://example.test/document.xml?annotation-1',
  type: 'oa:Annotation',
  'dcterms:created': '2026-07-10T01:02:03Z',
  'oa:motivatedBy': ['oa:identifying', 'oa:tagging'],
  'oa:hasBody': {
    '@id': 'https://example.test/people/1',
    '@type': ['oa:TextualBody', 'https://example.test/Person'],
    'dc:format': 'text/plain',
    'rdf:value': 'A & <B>',
  },
  'oa:hasTarget': {
    '@type': 'oa:SpecificResource',
    'oa:refinedBy': {
      '@type': 'oa:TextPositionSelector',
      'oa:start': 4,
    },
  },
};

describe('jsonLdToRdfXml', () => {
  test('serializes all named and blank nodes as flat RDF descriptions', () => {
    const xml = jsonLdToRdfXml(annotation);
    const document = new DOMParser().parseFromString(xml, 'application/xml');

    expect(document.querySelector('parsererror')).toBeNull();
    expect(document.getElementsByTagNameNS(annotation['@context'].rdf, 'Description')).toHaveLength(
      4,
    );
    expect(xml).toContain('rdf:about="https://example.test/document.xml?annotation-1"');
    expect(xml).toContain('rdf:about="https://example.test/people/1"');
    expect(xml).toContain('rdf:nodeID="leaf0"');
    expect(xml).toContain('rdf:nodeID="leaf1"');
  });

  test('expands types and preserves literal datatypes and language', () => {
    const xml = jsonLdToRdfXml(annotation);

    expect(xml).toContain('rdf:resource="http://www.w3.org/ns/oa#Annotation"');
    expect(xml).toContain('rdf:resource="https://example.test/Person"');
    expect(xml).toContain(
      'rdf:datatype="http://www.w3.org/2001/XMLSchema#dateTime">2026-07-10T01:02:03Z',
    );
    expect(xml).toContain('rdf:datatype="http://www.w3.org/ns/oa#Motivation">oa:identifying');
    expect(xml).toContain('rdf:datatype="http://www.w3.org/2001/XMLSchema#integer">4');
    expect(xml).toContain('<dc:format xml:lang="en">text/plain</dc:format>');
  });

  test('escapes XML text and attributes', () => {
    const xml = jsonLdToRdfXml(annotation);

    expect(xml).toContain('<rdf:value xml:lang="en">A &amp; &lt;B&gt;</rdf:value>');
  });
});
