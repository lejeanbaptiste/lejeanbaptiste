import { assignMissingIds, findAlignmentUnitsMissingIds } from './translationBootstrap';
import { recoverIdsFromSnapshot } from './translationRecovery';
import { buildSnapshotUnits, type SnapshotUnit } from './translationSnapshot';

const parse = (xml: string): Document => new DOMParser().parseFromString(xml, 'application/xml');

const SOURCE_XML = `<?xml version="1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><div>
  <p>First paragraph.</p>
  <p>Second paragraph.</p>
  <p>Third paragraph.</p>
</div></body></text></TEI>`;

/** Index a document and return its snapshot, mimicking a known-good save. */
const indexAndSnapshot = async (
  xml: string,
): Promise<{ doc: Document; snapshot: SnapshotUnit[] }> => {
  const doc = parse(xml);
  await assignMissingIds(doc, findAlignmentUnitsMissingIds(doc, 'p'));
  return { doc, snapshot: await buildSnapshotUnits(doc, 'p') };
};

const serialize = (doc: Document): string => new XMLSerializer().serializeToString(doc);

const idsOf = (xml: string): (string | null)[] =>
  Array.from(
    parse(xml).getElementsByTagNameNS('http://www.tei-c.org/ns/1.0', 'p'),
  ).map((p) => p.getAttribute('xml:id'));

describe('recoverIdsFromSnapshot', () => {
  test('restores all ids after an external tool stripped them (content unchanged)', async () => {
    const { doc, snapshot } = await indexAndSnapshot(SOURCE_XML);
    const originalIds = idsOf(serialize(doc));

    const scrambled = serialize(doc).replace(/\s*xml:id="[^"]*"/g, '');
    const result = await recoverIdsFromSnapshot(scrambled, snapshot, 'p');

    expect(result?.restored).toBe(3);
    expect(idsOf(result!.xml)).toEqual(originalIds);
  });

  test('leaves an edited paragraph alone and restores the others', async () => {
    const { doc, snapshot } = await indexAndSnapshot(SOURCE_XML);
    const originalIds = idsOf(serialize(doc));

    const scrambled = serialize(doc)
      .replace(/\s*xml:id="[^"]*"/g, '')
      .replace('Second paragraph.', 'Second paragraph, edited.');
    const result = await recoverIdsFromSnapshot(scrambled, snapshot, 'p');

    expect(result?.restored).toBe(2);
    const ids = idsOf(result!.xml);
    expect(ids[0]).toBe(originalIds[0]);
    expect(ids[1]).toBeNull();
    expect(ids[2]).toBe(originalIds[2]);
  });

  test('does not use duplicated content as an anchor', async () => {
    const duplicated = SOURCE_XML.replace('Third paragraph.', 'First paragraph.');
    const { doc, snapshot } = await indexAndSnapshot(duplicated);

    const scrambled = serialize(doc).replace(/\s*xml:id="[^"]*"/g, '');
    const result = await recoverIdsFromSnapshot(scrambled, snapshot, 'p');

    // only the unique middle paragraph is restored; the identical twins are skipped
    expect(result?.restored).toBe(1);
    const ids = idsOf(result!.xml);
    expect(ids[0]).toBeNull();
    expect(ids[1]).not.toBeNull();
    expect(ids[2]).toBeNull();
  });

  test('skips restoration when the snapshot id is already taken elsewhere', async () => {
    const { doc, snapshot } = await indexAndSnapshot(SOURCE_XML);
    const [firstId] = idsOf(serialize(doc));

    // strip all ids, then give an unrelated element the first unit's id
    const scrambledDoc = parse(serialize(doc).replace(/\s*xml:id="[^"]*"/g, ''));
    scrambledDoc
      .getElementsByTagNameNS('http://www.tei-c.org/ns/1.0', 'body')[0]!
      .setAttribute('xml:id', firstId!);

    const result = await recoverIdsFromSnapshot(serialize(scrambledDoc), snapshot, 'p');

    expect(result?.restored).toBe(2);
    expect(idsOf(result!.xml)[0]).toBeNull();
  });

  test('returns null when nothing needs restoring or nothing can be restored', async () => {
    const { doc, snapshot } = await indexAndSnapshot(SOURCE_XML);

    // intact document: nothing to do
    expect(await recoverIdsFromSnapshot(serialize(doc), snapshot, 'p')).toBeNull();

    // fully rewritten content: nothing matches
    const rewritten = serialize(doc)
      .replace(/\s*xml:id="[^"]*"/g, '')
      .replace(/First|Second|Third/g, 'Changed');
    expect(await recoverIdsFromSnapshot(rewritten, snapshot, 'p')).toBeNull();
  });
});
