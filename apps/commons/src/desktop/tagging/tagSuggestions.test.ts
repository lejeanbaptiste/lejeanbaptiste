import type { NodeDetail } from '@cwrc/leafwriter-validator';
import {
  filterTagSuggestions,
  getDefaultHighlightIndex,
  pinParagraphInsertOption,
  sortTagSuggestions,
  withInsertModeFallbacks,
} from './tagSuggestions';

const tag = (name: string, invalid = false): NodeDetail => ({
  name,
  type: 'tag',
  eventType: 'enterStartTag',
  invalid,
});

describe('sortTagSuggestions', () => {
  test('orders by project usage then alphabetically', () => {
    const sorted = sortTagSuggestions(
      [tag('note'), tag('persName'), tag('placeName')],
      { persName: 5, note: 1 },
    );
    expect(sorted.map((item) => item.name)).toEqual(['persName', 'note', 'placeName']);
  });

  test('moves preferred tag to front when present', () => {
    const sorted = sortTagSuggestions(
      [tag('note'), tag('persName'), tag('p')],
      {},
      'p',
    );
    expect(sorted[0]?.name).toBe('p');
  });
});

describe('filterTagSuggestions', () => {
  test('filters by tag name substring', () => {
    const filtered = filterTagSuggestions([tag('persName'), tag('placeName'), tag('p')], 'place');
    expect(filtered.map((item) => item.name)).toEqual(['placeName']);
  });
});

describe('pinParagraphInsertOption', () => {
  test('pins p first when caret is inside a paragraph', () => {
    const ctx = {
      element: { getAttribute: () => 'p' } as unknown as Element,
      hasContentSelection: false,
      rng: { startContainer: { nodeType: Node.TEXT_NODE, parentNode: null } } as unknown as Range,
      tagElement: { getAttribute: () => 'p' } as unknown as Element,
    };
    const body = document.createElement('div');
    const p = document.createElement('div');
    p.setAttribute('_tag', 'p');
    const text = document.createTextNode('Jean');
    p.appendChild(text);
    body.appendChild(p);
    (ctx.rng as { startContainer: Node }).startContainer = text;
    (window as unknown as { writer: { editor: { getBody: () => Element } } }).writer = {
      editor: { getBody: () => body },
    };

    const result = pinParagraphInsertOption([{ name: 'persName', type: 'tag', eventType: 'enterStartTag' }], 'insert', ctx);
    expect(result[0]?.name).toBe('p');
    expect(result[0]?.invalid).toBe(false);
  });
});

describe('withInsertModeFallbacks', () => {
  test('offers p when validator returns nothing inside a paragraph', () => {
    const ctx = {
      element: { getAttribute: () => 'p' } as unknown as Element,
      hasContentSelection: false,
      rng: { collapsed: true } as Range,
      tagElement: { getAttribute: () => 'p' } as unknown as Element,
    };
    expect(withInsertModeFallbacks([], 'insert', ctx)).toEqual([
      expect.objectContaining({ name: 'p', invalid: false }),
    ]);
  });
});

describe('getDefaultHighlightIndex', () => {
  test('prefers p in insert mode', () => {
    const tags = [tag('note'), tag('p'), tag('persName')];
    expect(getDefaultHighlightIndex(tags, 'insert', null)).toBe(1);
  });

  test('skips invalid preferred tag', () => {
    const tags = [tag('note'), tag('p', true), tag('persName')];
    expect(getDefaultHighlightIndex(tags, 'insert', 'p')).toBe(0);
  });
});
