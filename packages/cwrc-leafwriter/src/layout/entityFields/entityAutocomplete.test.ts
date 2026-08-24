/**
 * @jest-environment jsdom
 */
import {
  buildSuggestionsAtCaret,
  candidateFromEntity,
  caretAnchorPosition,
  getCaretQuery,
  rankEntityAutocomplete,
  scoreAliasMatch,
} from './entityAutocomplete';
import type { EntitySummary } from './entitySummary';

const person = (overrides: Partial<EntitySummary> = {}): EntitySummary => ({
  id: 'person-1',
  kind: 'person',
  names: [
    { lang: 'zh-Hant', text: '崔祖思' },
    { lang: 'zh-Latn', text: 'Cui Zusi' },
  ],
  primaryName: '崔祖思',
  romanizedName: 'Cui Zusi',
  translations: [],
  description: null,
  dates: null,
  familyName: 'Cui',
  authorityIds: [],
  classification: null,
  workType: null,
  ...overrides,
});

describe('candidateFromEntity', () => {
  test('a place gets no bogus family/given split in its aliases', () => {
    const place: EntitySummary = {
      id: 'place-1',
      kind: 'place',
      names: [{ lang: 'zh-Latn', text: 'Jiankang' }],
      primaryName: 'Jiankang',
      romanizedName: 'Jiankang',
      translations: [],
      description: null,
      dates: null,
      familyName: null,
      authorityIds: [],
      classification: null,
      workType: null,
    };
    const candidate = candidateFromEntity(place);
    expect(candidate.aliases).toEqual(['Jiankang']);
  });

  test('a person still gets family/given aliases', () => {
    const candidate = candidateFromEntity(person());
    expect(candidate.aliases).toEqual(expect.arrayContaining(['Cui', 'Zusi', 'Cui Zusi']));
  });
});

describe('scoreAliasMatch', () => {
  test('ranks exact and prefix matches', () => {
    expect(scoreAliasMatch('cui zusi', 'Cui Zusi')).toBeGreaterThan(
      scoreAliasMatch('cui', 'Cui Zusi'),
    );
    expect(scoreAliasMatch('cui', 'Cui Zusi')).toBeGreaterThan(0);
    expect(scoreAliasMatch('zu', 'Cui Zusi')).toBeGreaterThan(0);
    expect(scoreAliasMatch('x', 'Cui Zusi')).toBe(0);
  });
});

describe('rankEntityAutocomplete', () => {
  test('suggests unit entities by romanization prefix', () => {
    const candidates = [
      candidateFromEntity(person()),
      candidateFromEntity(
        person({
          id: 'person-2',
          romanizedName: 'Lu Shao',
          primaryName: '陸邵',
          familyName: '陸',
          names: [
            { lang: 'zh-Hant', text: '陸邵' },
            { lang: 'zh-Latn', text: 'Lu Shao' },
          ],
        }),
      ),
    ];
    const hits = rankEntityAutocomplete('Lu', candidates);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.candidate.id).toBe('person-2');
  });

  test('matches Chinese characters with a single glyph', () => {
    const hits = rankEntityAutocomplete('崔', [candidateFromEntity(person())]);
    expect(hits[0]!.candidate.id).toBe('person-1');
  });
});

describe('caretAnchorPosition', () => {
  test('does not fall back to the top-left corner when rects are empty (jsdom)', () => {
    const root = document.createElement('div');
    const text = document.createTextNode('Cui');
    root.appendChild(text);
    document.body.appendChild(root);

    const range = document.createRange();
    range.setStart(text, 3);
    range.collapse(true);
    const suggestions = buildSuggestionsAtCaret(range, [candidateFromEntity(person())]);
    expect(suggestions.length).toBeGreaterThan(0);
    // jsdom reports 0×0 rects; returning null is better than anchoring at (0, 4).
    expect(caretAnchorPosition(suggestions[0]!, range)).toBeNull();

    root.remove();
  });

  test('uses the previous character rect when the caret rect is empty', () => {
    const root = document.createElement('div');
    const text = document.createTextNode('Cui');
    root.appendChild(text);
    document.body.appendChild(root);

    const range = document.createRange();
    range.setStart(text, 3);
    range.collapse(true);
    const suggestions = buildSuggestionsAtCaret(range, [candidateFromEntity(person())]);

    const fake = {
      top: 140,
      bottom: 156,
      left: 90,
      right: 110,
      width: 20,
      height: 16,
      x: 90,
      y: 140,
      toJSON() {
        return this;
      },
    } as DOMRect;

    const originalClientRects = Range.prototype.getClientRects;
    const originalBounding = Range.prototype.getBoundingClientRect;
    Range.prototype.getClientRects = function getClientRects(this: Range) {
      if (!this.collapsed && this.endOffset === this.startOffset + 1) {
        return { length: 1, item: () => fake, 0: fake } as unknown as DOMRectList;
      }
      return { length: 0, item: () => null } as unknown as DOMRectList;
    };
    Range.prototype.getBoundingClientRect = function getBoundingClientRect(this: Range) {
      if (!this.collapsed && this.endOffset === this.startOffset + 1) return fake;
      return {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON() {
          return this;
        },
      } as DOMRect;
    };

    try {
      const anchor = caretAnchorPosition(suggestions[0]!, range);
      expect(anchor).toEqual({ top: 160, left: 110 });
    } finally {
      Range.prototype.getClientRects = originalClientRects;
      Range.prototype.getBoundingClientRect = originalBounding;
      root.remove();
    }
  });
});

describe('getCaretQuery / buildSuggestionsAtCaret', () => {
  test('reads the name token before the caret and builds suggestions', () => {
    const root = document.createElement('div');
    const text = document.createTextNode('See Cui Zu');
    root.appendChild(text);
    document.body.appendChild(root);

    const range = document.createRange();
    range.setStart(text, text.nodeValue!.length);
    range.collapse(true);

    const window = getCaretQuery(range);
    expect(window?.query).toBe('See Cui Zu');

    const suggestions = buildSuggestionsAtCaret(range, [candidateFromEntity(person())]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.candidate.id).toBe('person-1');
    // Longest matching suffix is "Cui Zu", not the whole window.
    expect(suggestions[0]!.query).toBe('Cui Zu');
    expect(suggestions[0]!.replaceStart).toBe(4);
    expect(suggestions[0]!.replaceEnd).toBe(10);

    root.remove();
  });
});
