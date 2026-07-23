import { stripRedundantNamespacesInElement } from './stripRedundantNamespaces';

describe('stripRedundantNamespacesInElement', () => {
  it('removes a default namespace redeclaration that matches the inherited one', () => {
    const doc = new DOMParser().parseFromString(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><date><era xmlns="http://www.tei-c.org/ns/1.0">昇明</era><suffix xmlns="http://www.tei-c.org/ns/1.0">中</suffix></date></TEI>',
      'application/xml',
    );
    stripRedundantNamespacesInElement(doc);
    const xml = new XMLSerializer().serializeToString(doc);
    expect(xml).toBe(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><date><era>昇明</era><suffix>中</suffix></date></TEI>',
    );
  });

  it('leaves a genuinely different default namespace alone', () => {
    const doc = new DOMParser().parseFromString(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><ref xmlns="http://www.w3.org/1999/xhtml">link</ref></text></TEI>',
      'application/xml',
    );
    stripRedundantNamespacesInElement(doc);
    const xml = new XMLSerializer().serializeToString(doc);
    expect(xml).toBe(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><ref xmlns="http://www.w3.org/1999/xhtml">link</ref></text></TEI>',
    );
  });

  it('removes a redundant prefixed namespace redeclaration', () => {
    const doc = new DOMParser().parseFromString(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></rdf:RDF></TEI>',
      'application/xml',
    );
    stripRedundantNamespacesInElement(doc);
    const xml = new XMLSerializer().serializeToString(doc);
    expect(xml).toBe(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description/></rdf:RDF></TEI>',
    );
  });

  it('leaves the root element namespace declaration untouched', () => {
    const doc = new DOMParser().parseFromString(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><p>text</p></TEI>',
      'application/xml',
    );
    stripRedundantNamespacesInElement(doc);
    const xml = new XMLSerializer().serializeToString(doc);
    expect(xml).toBe('<TEI xmlns="http://www.tei-c.org/ns/1.0"><p>text</p></TEI>');
  });
});
