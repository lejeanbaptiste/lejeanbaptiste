import {
  buildSearchText,
  hasTibetan,
  hashText,
  isTibetanEdgeChar,
  normalizeMatchPattern,
} from './normalize';

describe('buildSearchText — non-Tibetan', () => {
  it("deletes whitespace under 'ignore'", () => {
    expect(buildSearchText('a b\tc', 'ignore').text).toBe('abc');
  });

  it("collapses whitespace to one space under 'collapse'", () => {
    expect(buildSearchText('a  b\t c', 'collapse').text).toBe('a b c');
  });
});

describe('buildSearchText — Tibetan', () => {
  it("collapses rather than deletes whitespace even under 'ignore'", () => {
    const { text, map } = buildSearchText('བོད་ ཡིག', 'ignore');
    expect(text).toBe('བོད་ ཡིག');
    // the injected space maps just past the tsheg it follows
    expect(map.length).toBe(text.length);
  });

  it('folds the non-breaking tsheg U+0F0C to U+0F0B', () => {
    expect(buildSearchText('ཀ༌ཁ', 'ignore').text).toBe('ཀ་ཁ');
    // length-preserving: the map still has one entry per output char
    expect(buildSearchText('ཀ༌ཁ', 'ignore').map).toEqual([0, 1, 2]);
  });

  it('leaves a tsheg-only Tibetan node byte-identical (hash stable for existing anchors)', () => {
    const raw = 'ཐུབ་བསྟན་རྒྱ་མཚོ';
    const before = hashText(raw); // what an 'ignore' build produced before this change
    expect(hashText(buildSearchText(raw, 'ignore').text)).toBe(before);
  });

  it('still collapses when the caller already asked for collapse', () => {
    expect(buildSearchText('བོད་  ཡིག', 'collapse').text).toBe('བོད་ ཡིག');
  });
});

describe('hasTibetan', () => {
  it('detects Tibetan, ignores Han and Latin', () => {
    expect(hasTibetan('བོད')).toBe(true);
    expect(hasTibetan('張衡')).toBe(false);
    expect(hasTibetan('abc')).toBe(false);
  });
});

describe('normalizeMatchPattern', () => {
  it('drops a terminal shad and folds U+0F0C, keeps interior tshegs', () => {
    expect(normalizeMatchPattern('བཀྲ་ཤིས།')).toBe('བཀྲ་ཤིས');
    expect(normalizeMatchPattern('ཀ༌ཁ')).toBe('ཀ་ཁ');
    expect(normalizeMatchPattern('ཙོང་ཁ་པ')).toBe('ཙོང་ཁ་པ');
  });

  it('is NFC-only for non-Tibetan', () => {
    expect(normalizeMatchPattern('張衡')).toBe('張衡');
  });
});

describe('isTibetanEdgeChar', () => {
  it('accepts tsheg, shad, whitespace, a-chung, and end-of-string', () => {
    expect(isTibetanEdgeChar(undefined)).toBe(true);
    expect(isTibetanEdgeChar('་')).toBe(true);
    expect(isTibetanEdgeChar('།')).toBe(true);
    expect(isTibetanEdgeChar(' ')).toBe(true);
    expect(isTibetanEdgeChar('འ')).toBe(true);
  });

  it('rejects a base letter or a subjoined consonant (mid-syllable)', () => {
    expect(isTibetanEdgeChar('ལ')).toBe(false);
    expect(isTibetanEdgeChar('ྒ')).toBe(false);
  });
});
