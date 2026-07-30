import {
  buildNobleTitleVocabulary,
  parseNobleTitleSpan,
  type SpanSegment,
} from './nobleTitleSpanParser';
import type { AuthorityCandidate } from './authority';

/** Minimal pack rows carrying the components the vocabulary builder reads. */
const packRow = (
  fief: string,
  roleName: string,
  posthumousName?: string,
  dynasty?: string,
): AuthorityCandidate => ({
  source: 'norbert-direct',
  authorityId: `t:${fief}${roleName}`,
  kind: 'person',
  primaryName: 'x',
  searchStrings: ['x'],
  metadata: { isNobleTitle: true, dynasty, nobleTitle: { fief, roleName, posthumousName } },
});

const vocabulary = buildNobleTitleVocabulary([
  packRow('魏', '帝', '武', '魏'),
  packRow('漢', '帝', '昭烈', '漢'),
  packRow('鄱陽', '王', undefined, '梁'),
  packRow('博陵', '王', '文簡', '魏'),
  packRow('安平', '王', '悼', '漢'),
]);

const text = (value: string): SpanSegment => ({ kind: 'text', text: value });
const el = (localName: string, value: string): SpanSegment => ({
  kind: 'element',
  localName,
  text: value,
});

/** Compact view of a parse: role=text pairs in document order. */
const shape = (segments: SpanSegment[]) =>
  parseNobleTitleSpan(segments, vocabulary).slots.map((s) => `${s.role}=${s.text}`);

describe('parseNobleTitleSpan — plain text', () => {
  it('decomposes 魏武帝 into fief + posthumous name + rank', () => {
    expect(shape([text('魏武帝')])).toEqual(['fief=魏', 'posthumousName=武', 'rank=帝']);
  });

  it('decomposes a fief + rank title with no posthumous name', () => {
    expect(shape([text('鄱陽王')])).toEqual(['fief=鄱陽', 'rank=王']);
  });

  it('decomposes a dynasty-qualified territorial title', () => {
    expect(shape([text('魏博陵文簡王')])).toEqual([
      'dynasty=魏',
      'fief=博陵',
      'posthumousName=文簡',
      'rank=王',
    ]);
  });

  it('prefers the longest rank (皇帝 over 帝)', () => {
    const slots = parseNobleTitleSpan([text('魏武皇帝')], vocabulary).slots;
    expect(slots.find((s) => s.role === 'rank')!.text).toBe('皇帝');
    expect(slots.find((s) => s.role === 'posthumousName')!.text).toBe('武');
  });

  it('reads a trailing remainder after the rank as a personal name', () => {
    expect(shape([text('鄱陽王範')])).toEqual(['fief=鄱陽', 'rank=王', 'personName=範']);
  });

  it('accepts an unrecognised posthumous name at reduced confidence', () => {
    const result = parseNobleTitleSpan([text('鄱陽某王')], vocabulary);
    expect(result.slots.map((s) => `${s.role}=${s.text}`)).toEqual([
      'fief=鄱陽',
      'posthumousName=某',
      'rank=王',
    ]);
    expect(result.confidence).toBe('partial');
    expect(result.slots.find((s) => s.role === 'posthumousName')!.unverified).toBe(true);
  });

  it('reports no parse when the span holds no recognised rank', () => {
    const result = parseNobleTitleSpan([text('曹操')], vocabulary);
    expect(result.slots).toEqual([]);
    expect(result.confidence).toBe('none');
    expect(result.conflicts[0]).toMatch(/no recognised noble-title rank/);
  });
});

describe('parseNobleTitleSpan — span already contains tagged elements', () => {
  it('reuses an existing <placeName> on the fief instead of re-tagging it', () => {
    const result = parseNobleTitleSpan([el('placeName', '鄱陽'), text('王')], vocabulary);
    expect(result.slots.map((s) => `${s.role}=${s.text}`)).toEqual(['fief=鄱陽', 'rank=王']);
    const fief = result.slots.find((s) => s.role === 'fief')!;
    expect(fief.existingTag).toBe('placeName');
    expect(fief.retagRequired).toBeUndefined();
    expect(result.conflicts).toEqual([]);
    expect(result.confidence).toBe('exact');
  });

  it('reuses an existing <roleName> on the rank', () => {
    const result = parseNobleTitleSpan([text('鄱陽'), el('roleName', '王')], vocabulary);
    const rank = result.slots.find((s) => s.role === 'rank')!;
    expect(rank.existingTag).toBe('roleName');
    expect(rank.retagRequired).toBeUndefined();
    expect(result.conflicts).toEqual([]);
  });

  it('handles a fully pre-tagged span with no untagged text left', () => {
    const result = parseNobleTitleSpan(
      [el('placeName', '博陵'), text('文簡'), el('roleName', '王')],
      vocabulary,
    );
    expect(result.slots.map((s) => `${s.role}=${s.text}`)).toEqual([
      'fief=博陵',
      'posthumousName=文簡',
      'rank=王',
    ]);
    expect(result.conflicts).toEqual([]);
  });

  it('lets an existing <placeName> pin the fief boundary', () => {
    // Untagged, 安平悼王 could split several ways; the tag fixes fief=安平.
    const result = parseNobleTitleSpan([el('placeName', '安平'), text('悼王')], vocabulary);
    expect(result.slots.map((s) => `${s.role}=${s.text}`)).toEqual([
      'fief=安平',
      'posthumousName=悼',
      'rank=王',
    ]);
    expect(result.slots.find((s) => s.role === 'fief')!.existingTag).toBe('placeName');
  });

  it('warns when an existing tag appears to swallow more than one component', () => {
    // <placeName>魏武</placeName> spans fief 魏 + posthumous name 武. The tag
    // fixes its own boundary, so this can only be caught by noticing the
    // tagged text decomposes cleanly on its own.
    const result = parseNobleTitleSpan([el('placeName', '魏武'), text('帝')], vocabulary);
    // The tag is honoured, never silently re-cut...
    expect(result.slots.map((s) => `${s.role}=${s.text}`)).toEqual(['fief=魏武', 'rank=帝']);
    // ...but the likely mis-tag is surfaced for the user to act on.
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatch(/may span more than the fief/);
    expect(result.conflicts[0]).toMatch(/fief "魏" \+ posthumousName "武"/);
  });

  it('does not warn when a tagged unknown fief has no clean decomposition', () => {
    const result = parseNobleTitleSpan([el('placeName', '某地'), text('王')], vocabulary);
    expect(result.conflicts).toEqual([]);
  });

  it('refuses to split an element across a rank boundary', () => {
    // A single element covering the whole title cannot be decomposed without
    // destroying it, so there is no valid placement.
    const result = parseNobleTitleSpan([el('persName', '鄱陽王')], vocabulary);
    expect(result.confidence).toBe('none');
    expect(result.conflicts[0]).toMatch(/does not align with any component boundary/);
  });

  it('preserves an existing element that carries no recognised vocabulary text', () => {
    const result = parseNobleTitleSpan([el('placeName', '某地'), text('王')], vocabulary);
    expect(result.slots.map((s) => `${s.role}=${s.text}`)).toEqual(['fief=某地', 'rank=王']);
    const fief = result.slots.find((s) => s.role === 'fief')!;
    expect(fief.existingTag).toBe('placeName');
    expect(fief.unverified).toBe(true);
    expect(result.confidence).toBe('partial');
  });
});

describe('buildNobleTitleVocabulary', () => {
  it('seeds ranks even with no pack, so parsing degrades gracefully', () => {
    const empty = buildNobleTitleVocabulary();
    expect(empty.ranks.has('帝')).toBe(true);
    expect(empty.ranks.has('王')).toBe(true);
    expect(empty.dynasties.size).toBeGreaterThan(0); // from the curated crosswalk
  });

  it('collects fiefs, ranks and posthumous names from pack records', () => {
    expect(vocabulary.fiefs.has('鄱陽')).toBe(true);
    expect(vocabulary.posthumousNames.has('文簡')).toBe(true);
    expect(vocabulary.ranks.has('王')).toBe(true);
  });
});
