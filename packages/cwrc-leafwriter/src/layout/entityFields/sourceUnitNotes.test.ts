/**
 * @jest-environment jsdom
 */
import {
  collectNotesFromSourceUnitXml,
  replaceNotesWithPlaceholdersInSourceXml,
} from './sourceUnitNotes';

describe('collectNotesFromSourceUnitXml', () => {
  test('collects top-level notes in document order with their inner XML', () => {
    const xml =
      '<p>Claim.<note place="foot">See discussion.</note> More text.' +
      '<note place="foot">Second <hi rend="italic">note</hi>.</note></p>';

    const hits = collectNotesFromSourceUnitXml(xml);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ index: 0 });
    expect(hits[0]!.innerXml).toContain('See discussion.');
    expect(hits[1]!.innerXml).toContain('Second');
    expect(hits[1]!.innerXml).toContain('<hi rend="italic">note</hi>');
  });

  test('nested notes are flattened into the parent note innerXml, not split out', () => {
    const xml = '<p><note place="foot">Outer <note place="foot">Inner</note> text.</note></p>';
    const hits = collectNotesFromSourceUnitXml(xml);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.innerXml).toContain('Outer');
    expect(hits[0]!.innerXml).toContain('Inner');
    expect(hits[0]!.innerXml).toContain('<note');
  });

  test('returns empty array when there are no notes', () => {
    expect(collectNotesFromSourceUnitXml('<p>no notes here</p>')).toEqual([]);
  });

  test('returns empty array for blank input', () => {
    expect(collectNotesFromSourceUnitXml('')).toEqual([]);
  });
});

describe('replaceNotesWithPlaceholdersInSourceXml', () => {
  test('replaces each top-level <note> with {{note:N}} in document order', () => {
    const xml =
      '<p>Claim.<note place="foot">See discussion.</note> More text.' +
      '<note place="foot">Second note.</note></p>';

    const rewritten = replaceNotesWithPlaceholdersInSourceXml(xml);
    expect(rewritten).toContain('{{note:0}}');
    expect(rewritten).toContain('{{note:1}}');
    expect(rewritten).not.toContain('<note');
    expect(rewritten).not.toContain('See discussion');
    expect(rewritten).not.toContain('Second note');
    // Surrounding prose stays.
    expect(rewritten).toContain('Claim.');
    expect(rewritten).toContain('More text.');
  });

  test('indices match collectNotesFromSourceUnitXml', () => {
    const xml = '<p><note place="foot">A</note> and <note place="foot">B</note></p>';
    const hits = collectNotesFromSourceUnitXml(xml);
    const rewritten = replaceNotesWithPlaceholdersInSourceXml(xml);
    expect(hits).toHaveLength(2);
    expect(rewritten).toContain('{{note:0}}');
    expect(rewritten).toContain('{{note:1}}');
    expect(hits[0]!.innerXml).toBe('A');
    expect(hits[1]!.innerXml).toBe('B');
  });

  test('a nested note collapses with its parent into a single placeholder', () => {
    const xml = '<p><note place="foot">Outer <note place="foot">Inner</note> text.</note></p>';
    const rewritten = replaceNotesWithPlaceholdersInSourceXml(xml);
    expect(rewritten).toContain('{{note:0}}');
    expect(rewritten).not.toContain('{{note:1}}');
    expect(rewritten).not.toContain('<note');
  });

  test('returns original when there are no notes', () => {
    const xml = '<p>no notes here</p>';
    expect(replaceNotesWithPlaceholdersInSourceXml(xml)).toBe(xml);
  });

  test('returns original for blank input', () => {
    expect(replaceNotesWithPlaceholdersInSourceXml('')).toBe('');
  });
});
