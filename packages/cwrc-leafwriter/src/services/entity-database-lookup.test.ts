import { searchEntityDocument } from './entity-database-lookup';

const TEI_NS = 'http://www.tei-c.org/ns/1.0';

function personDocument(...names: string[]): Document {
  const doc = document.implementation.createDocument(TEI_NS, 'TEI');
  const list = doc.createElementNS(TEI_NS, 'listPerson');
  doc.documentElement.appendChild(list);

  names.forEach((name, index) => {
    const person = doc.createElementNS(TEI_NS, 'person');
    person.setAttribute('xml:id', `person-${index}`);
    const persName = doc.createElementNS(TEI_NS, 'persName');
    persName.textContent = name;
    person.appendChild(persName);
    list.appendChild(person);
  });

  return doc;
}

describe('searchEntityDocument', () => {
  it('does not match a person name by surname containment', () => {
    const doc = personDocument('劉', '劉惔', '劉備');

    const results = searchEntityDocument(doc, 'person', '劉惔');

    expect(results).toHaveLength(1);
    expect(results[0]?.label).toBe('劉惔');
  });

  it('matches names case-insensitively and ignores surrounding whitespace', () => {
    const doc = personDocument('John Doe');

    const results = searchEntityDocument(doc, 'person', '  john   doe ');

    expect(results).toHaveLength(1);
    expect(results[0]?.label).toBe('John Doe');
  });
});
