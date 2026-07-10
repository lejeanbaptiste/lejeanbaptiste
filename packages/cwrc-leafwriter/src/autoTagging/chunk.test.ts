import { chunkDocument } from './chunk';
import { normalizeDomText } from './normalize';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

describe('chunkDocument', () => {
  it('never cuts inside a block element', () => {
    const doc = parse(
      '<TEI><text><body>' +
        '<p>alpha</p>'.repeat(1) +
        '<p>beta gamma delta epsilon</p>' +
        '<p>zeta</p>' +
        '</body></text></TEI>',
    );
    const chunks = chunkDocument(doc, { policy: 'ignore', targetChars: 6 });
    // With a tiny target size each <p> should still land whole in some chunk.
    const full = chunks.map((c) => c.text).join('');
    expect(full).toBe('alphabetagammadeltaepsilonzeta');
    for (const chunk of chunks) {
      expect('alpha,betagammadeltaepsilon,zeta'.split(',')).toContain(chunk.text);
    }
  });

  it('packs multiple blocks into one chunk when they fit the target size', () => {
    const doc = parse('<TEI><text><body><p>alpha</p><p>beta</p><p>gamma</p></body></text></TEI>');
    const chunks = chunkDocument(doc, { policy: 'ignore', targetChars: 100 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text).toBe('alphabetagamma');
  });

  it('emits one leaf block per chunk when maxBlocksPerChunk is 1', () => {
    const doc = parse('<TEI><text><body><p>alpha</p><p>beta</p><p>gamma</p></body></text></TEI>');
    const chunks = chunkDocument(doc, { policy: 'ignore', targetChars: 10_000, maxBlocksPerChunk: 1 });
    expect(chunks).toHaveLength(3);
    expect(chunks.map((c) => c.text)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('produces non-overlapping, contiguous chunks covering the whole document', () => {
    const doc = parse('<TEI><text><body><p>alpha</p><p>beta</p><p>gamma</p></body></text></TEI>');
    const chunks = chunkDocument(doc, { policy: 'ignore', targetChars: 5 });
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i]!.start).toBe(chunks[i - 1]!.end);
    }
  });

  it('includes context margin without it counting as part of the taggable text', () => {
    const doc = parse('<TEI><text><body><p>alpha</p><p>beta</p><p>gamma</p></body></text></TEI>');
    const chunks = chunkDocument(doc, { policy: 'ignore', targetChars: 5, marginChars: 4 });
    const middle = chunks.find((c) => c.text === 'beta')!;
    expect(middle.before.endsWith('lpha'.slice(-4))).toBe(true);
    expect(middle.after.startsWith('gamm'.slice(0, 4))).toBe(true);
  });

  it('falls back to one whole-document chunk when no block elements are recognized', () => {
    const doc = parse('<TEI><text>plain text with no blocks</text></TEI>');
    const chunks = chunkDocument(doc, { policy: 'collapse', blockTags: ['p'] });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text).toBe('plain text with no blocks');
  });

  it('returns no chunks for an empty document', () => {
    const doc = parse('<TEI><text></text></TEI>');
    expect(chunkDocument(doc, { policy: 'ignore' })).toEqual([]);
  });

  describe('range scoping', () => {
    const doc = () =>
      parse('<TEI><text><body><p>alpha</p><p>beta</p><p>gamma</p></body></text></TEI>');
    const options = { policy: 'ignore' as const, maxBlocksPerChunk: 1 };

    it('keeps only chunks intersecting the range', () => {
      // "beta" spans offsets 5..9 in "alphabetagamma".
      const chunks = chunkDocument(doc(), { ...options, range: { start: 6, end: 8 } });
      expect(chunks.map((c) => c.text)).toEqual(['beta']);
    });

    it('keeps a whole block on partial overlap', () => {
      // Range straddles the alpha/beta boundary — both blocks stay whole.
      const chunks = chunkDocument(doc(), { ...options, range: { start: 3, end: 7 } });
      expect(chunks.map((c) => c.text)).toEqual(['alpha', 'beta']);
    });

    it('ignores an empty or inverted range', () => {
      expect(chunkDocument(doc(), { ...options, range: { start: 5, end: 5 } })).toHaveLength(3);
      expect(chunkDocument(doc(), { ...options, range: null })).toHaveLength(3);
    });

    it('chunk offsets stay in the whole-document space', () => {
      const chunks = chunkDocument(doc(), { ...options, range: { start: 6, end: 8 } });
      expect(chunks[0]!.start).toBe(5);
      expect(chunks[0]!.end).toBe(9);
    });
  });
});
