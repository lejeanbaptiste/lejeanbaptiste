import {
  assignMissingIds,
  createTranslationShell,
  findAlignmentUnitsMissingIds,
  findDuplicateAlignmentUnitIds,
  reindexAlignmentUnits,
  resyncTranslationShell,
} from './translationBootstrap';

const parse = (xml: string): Document => new DOMParser().parseFromString(xml, 'application/xml');

const TEI_SAMPLE = `<?xml version="1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text>
    <body>
      <div type="chapter">
        <p>First paragraph.</p>
        <p>Second paragraph.</p>
      </div>
      <div type="chapter" xml:id="ch2">
        <p>Third paragraph.</p>
      </div>
    </body>
  </text>
</TEI>`;

const ORLANDO_SAMPLE = `<?xml version="1.0"?>
<ENTRY>
  <BODY>
    <div type="chapter">
      <p>First.</p>
    </div>
  </BODY>
</ENTRY>`;

describe('findAlignmentUnitsMissingIds', () => {
  test('finds divs without xml:id in a TEI document', () => {
    const doc = parse(TEI_SAMPLE);
    const missing = findAlignmentUnitsMissingIds(doc, 'div');
    expect(missing).toHaveLength(1);
    expect(missing[0]?.getAttribute('type')).toBe('chapter');
    expect(missing[0]?.getAttribute('xml:id')).toBeNull();
  });

  test('finds divs without xml:id in a non-namespaced (Orlando-style) document', () => {
    const doc = parse(ORLANDO_SAMPLE);
    const missing = findAlignmentUnitsMissingIds(doc, 'div');
    expect(missing).toHaveLength(1);
  });

  test('returns empty when all units already have ids', () => {
    const doc = parse(TEI_SAMPLE);
    for (const div of findAlignmentUnitsMissingIds(doc, 'div')) {
      div.setAttribute('xml:id', 'x');
    }
    expect(findAlignmentUnitsMissingIds(doc, 'div')).toHaveLength(0);
  });
});

describe('assignMissingIds', () => {
  test('assigns collision-safe ids avoiding existing ones', async () => {
    const doc = parse(TEI_SAMPLE);
    const missing = findAlignmentUnitsMissingIds(doc, 'div');
    const assigned = await assignMissingIds(doc, missing, 'twu');

    expect(assigned).toHaveLength(1);
    expect(assigned[0]?.id).not.toBe('ch2');
    expect(assigned[0]?.id).toMatch(/^twu-[0-9a-f]{16}$/);
    expect(assigned[0]?.element.getAttribute('xml:id')).toBe(assigned[0]?.id);
  });

  test('ids are content-hash-derived: reassignment after id loss regenerates the same id', async () => {
    const doc = parse(TEI_SAMPLE);
    const missing = findAlignmentUnitsMissingIds(doc, 'div');
    const [first] = await assignMissingIds(doc, missing, 'twu');

    // simulate an undo/external tool stripping the id, content unchanged
    first!.element.removeAttribute('xml:id');
    const [again] = await assignMissingIds(
      doc,
      findAlignmentUnitsMissingIds(doc, 'div'),
      'twu',
    );

    expect(again?.id).toBe(first!.id);
  });

  test('identical content gets occurrence suffixes in document order', async () => {
    const doc = parse(`<?xml version="1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><div>
  <p>Amen.</p>
  <p>Amen.</p>
  <p>Amen.</p>
</div></body></text></TEI>`);
    const assigned = await assignMissingIds(doc, findAlignmentUnitsMissingIds(doc, 'p'), 'twu');

    expect(assigned).toHaveLength(3);
    const [a, b, c] = assigned.map((entry) => entry.id);
    expect(b).toBe(`${a}-2`);
    expect(c).toBe(`${a}-3`);
    expect(new Set([a, b, c]).size).toBe(3);
  });

  test('does not reuse an id that already exists in the document', async () => {
    const doc = parse(TEI_SAMPLE);
    const missing = findAlignmentUnitsMissingIds(doc, 'div');
    const [assigned] = await assignMissingIds(doc, missing, 'twu');

    // a second document where another element already holds that hash id
    const doc2 = parse(TEI_SAMPLE);
    doc2
      .getElementsByTagNameNS('http://www.tei-c.org/ns/1.0', 'body')[0]!
      .setAttribute('xml:id', assigned!.id);
    const [reassigned] = await assignMissingIds(
      doc2,
      findAlignmentUnitsMissingIds(doc2, 'div'),
      'twu',
    );

    expect(reassigned?.id).toBe(`${assigned!.id}-2`);
  });
});

describe('createTranslationShell', () => {
  test('mirrors the structural shell down to and including the alignment unit', async () => {
    const doc = parse(TEI_SAMPLE);
    const missing = findAlignmentUnitsMissingIds(doc, 'div');
    await assignMissingIds(doc, missing, 'twu');

    const shell = createTranslationShell(doc, 'chapter1.xml', 'fr', 'div');
    const root = shell.documentElement;

    expect(root.tagName).toBe('translation');
    expect(root.getAttribute('xml:lang')).toBe('fr');
    expect(root.getAttribute('corresp')).toBe('chapter1.xml');

    const divs = Array.from(root.getElementsByTagName('div'));
    expect(divs).toHaveLength(2);
    for (const div of divs) {
      expect(div.getAttribute('corresp')).toMatch(/^chapter1\.xml#/);
      // content nested inside the alignment unit is not copied
      expect(div.getElementsByTagName('p')).toHaveLength(0);
    }
  });

  test('does not include divs lacking an xml:id (bootstrap must run first)', () => {
    const doc = parse(TEI_SAMPLE); // one div still has no xml:id here
    const shell = createTranslationShell(doc, 'chapter1.xml', 'fr', 'div');
    const divs = Array.from(shell.documentElement.getElementsByTagName('div'));
    expect(divs).toHaveLength(1);
    expect(divs[0]?.getAttribute('corresp')).toBe('chapter1.xml#ch2');
  });
});

const SPLIT_PARAGRAPH_XML = `<?xml version="1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text>
    <body>
      <div type="chapter" xml:id="ch1">
        <p xml:id="p1">First half.</p>
        <p xml:id="p1">Second half (split copied the id).</p>
        <p>Never had an id.</p>
      </div>
    </body>
  </text>
</TEI>`;

describe('findDuplicateAlignmentUnitIds', () => {
  test('finds paragraphs sharing an id after a split', () => {
    const doc = parse(SPLIT_PARAGRAPH_XML);
    const duplicates = findDuplicateAlignmentUnitIds(doc, 'p');
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.id).toBe('p1');
    expect(duplicates[0]?.elements).toHaveLength(2);
  });

  test('returns empty when there are no duplicates', () => {
    const doc = parse(TEI_SAMPLE);
    expect(findDuplicateAlignmentUnitIds(doc, 'div')).toHaveLength(0);
  });
});

describe('reindexAlignmentUnits', () => {
  test('keeps the id on the first duplicate and reassigns the rest, and assigns missing ids', async () => {
    const doc = parse(SPLIT_PARAGRAPH_XML);
    const result = await reindexAlignmentUnits(doc, 'p', 'twu');

    const paragraphs = Array.from(
      doc.getElementsByTagNameNS('http://www.tei-c.org/ns/1.0', 'p'),
    );
    expect(paragraphs[0]?.getAttribute('xml:id')).toBe('p1');
    expect(paragraphs[1]?.getAttribute('xml:id')).not.toBe('p1');
    expect(paragraphs[1]?.getAttribute('xml:id')).toBeTruthy();
    expect(paragraphs[2]?.getAttribute('xml:id')).toBeTruthy();

    expect(result.reassigned).toHaveLength(1);
    expect(result.reassigned[0]?.element).toBe(paragraphs[1]);
    expect(result.newlyAssigned).toHaveLength(1);
    expect(result.newlyAssigned[0]?.element).toBe(paragraphs[2]);

    // no duplicates remain
    expect(findDuplicateAlignmentUnitIds(doc, 'p')).toHaveLength(0);
    expect(findAlignmentUnitsMissingIds(doc, 'p')).toHaveLength(0);
  });
});

describe('resyncTranslationShell', () => {
  test('preserves translated content for ids that survive, leaves new units empty', async () => {
    const sourceDoc = parse(SPLIT_PARAGRAPH_XML);

    // Simulate an existing translation file created before the split happened: one <p>
    // translated, corresponding to the original (pre-duplicate) p1.
    const existingTranslationDoc = parse(
      `<translation xml:lang="fr" corresp="chapter1.xml"><div type="chapter" corresp="chapter1.xml#ch1"><p corresp="chapter1.xml#p1">Traduction existante.</p></div></translation>`,
    );

    await reindexAlignmentUnits(sourceDoc, 'p', 'twu');

    const resynced = resyncTranslationShell(
      sourceDoc,
      existingTranslationDoc,
      'chapter1.xml',
      'fr',
      'p',
    );

    const paragraphs = Array.from(resynced.documentElement.getElementsByTagName('p'));
    expect(paragraphs).toHaveLength(3);

    const p1 = paragraphs.find((p) => p.getAttribute('corresp') === 'chapter1.xml#p1');
    expect(p1?.innerHTML).toBe('Traduction existante.');

    const others = paragraphs.filter((p) => p.getAttribute('corresp') !== 'chapter1.xml#p1');
    expect(others).toHaveLength(2);
    for (const other of others) {
      expect(other.innerHTML.trim()).toBe('');
    }
  });

  test('carries the standOff bibliography across a resync, GC-ing orphaned entries', async () => {
    const sourceDoc = parse(SPLIT_PARAGRAPH_XML);

    // Existing companion: one cited entry referenced from a surviving unit's footnote,
    // one entry no footnote references anymore (orphan to be GC'd).
    const existingTranslationDoc = parse(
      `<translation xml:lang="fr" corresp="chapter1.xml"><standOff><listBibl type="zotero"><bibl xml:id="zbib-KEEP1234" corresp="http://zotero.org/users/1/items/KEEP1234"><note type="csl-json"><![CDATA[{"id":"KEEP1234","type":"book"}]]></note></bibl><bibl xml:id="zbib-DROP5678" corresp="http://zotero.org/users/1/items/DROP5678"><note type="csl-json"><![CDATA[{"id":"DROP5678","type":"book"}]]></note></bibl></listBibl></standOff><div type="chapter" corresp="chapter1.xml#ch1"><p corresp="chapter1.xml#p1">Traduction.<note place="foot"><bibl type="zotero-ref" corresp="#zbib-KEEP1234">Cit.</bibl></note></p></div></translation>`,
    );

    await reindexAlignmentUnits(sourceDoc, 'p', 'twu');

    const resynced = resyncTranslationShell(
      sourceDoc,
      existingTranslationDoc,
      'chapter1.xml',
      'fr',
      'p',
    );

    expect(resynced.documentElement.firstElementChild?.localName).toBe('standOff');
    const ids = Array.from(resynced.getElementsByTagName('listBibl')[0]?.children ?? []).map(
      (bibl) => bibl.getAttribute('xml:id'),
    );
    expect(ids).toEqual(['zbib-KEEP1234']);
  });
});

describe('header exclusion', () => {
  const XML_WITH_HEADER_PS = `<?xml version="1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc>
      <publicationStmt><p>Header pub</p></publicationStmt>
      <sourceDesc><p>Header source</p></sourceDesc>
    </fileDesc>
  </teiHeader>
  <text><body><div>
    <p>Body one</p>
    <p>Body two</p>
  </div></body></text>
</TEI>`;

  test('never assigns ids to header paragraphs', async () => {
    const doc = parse(XML_WITH_HEADER_PS);
    const missing = findAlignmentUnitsMissingIds(doc, 'p');
    expect(missing).toHaveLength(2);

    await assignMissingIds(doc, missing, 'twu');
    const headerPs = Array.from(doc.getElementsByTagNameNS('http://www.tei-c.org/ns/1.0', 'p'))
      .filter((p) => p.closest('teiHeader'));
    for (const p of headerPs) {
      expect(p.getAttribute('xml:id')).toBeNull();
    }
  });

  test('never includes header paragraphs in the translation shell', async () => {
    const doc = parse(XML_WITH_HEADER_PS);
    await assignMissingIds(doc, findAlignmentUnitsMissingIds(doc, 'p'), 'twu');
    // simulate a header p that somehow has an id (e.g. from an earlier buggy index)
    const headerP = doc.getElementsByTagNameNS('http://www.tei-c.org/ns/1.0', 'p')[0]!;
    headerP.setAttribute('xml:id', 'stray');

    const shell = createTranslationShell(doc, 'a.xml', 'fr', 'p');
    const corresps = Array.from(shell.getElementsByTagName('p')).map((p) =>
      p.getAttribute('corresp'),
    );
    expect(corresps).toHaveLength(2);
    expect(corresps).not.toContain('a.xml#stray');
  });
});
