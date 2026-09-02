import { missingPlaceholders, collectPlaceholderInventory } from './aiPlaceholderGuard';
import { normalizeAiPlaceholders } from './normalizeAiPlaceholders';

describe('normalizeAiPlaceholders', () => {
  test('repairs smart-quoted date and entity placeholders', () => {
    expect(normalizeAiPlaceholders('{{“date:0}}')).toBe('{{date:0}}');
    expect(normalizeAiPlaceholders('{{“entity:office-1”}}')).toBe('{{entity:office-1}}');
    expect(normalizeAiPlaceholders('{{holding:o1}}')).toBe('{{holding:o1}}');
  });

  test('repairs smart-quoted note placeholders', () => {
    expect(normalizeAiPlaceholders('{{“note:0”}}')).toBe('{{note:0}}');
    expect(normalizeAiPlaceholders("{{'note: 2 '}}")).toBe('{{note:2}}');
  });
});

describe('collectPlaceholderInventory', () => {
  test('counts holding/as/mention/date/opaque tokens', () => {
    const text = '{{date:0}}以{{holding:1}}{{mention:2}}為{{as:opaque:0}}，{{mention:2}}';
    const inv = collectPlaceholderInventory(text);
    expect(inv.get('{{date:0}}')).toBe(1);
    expect(inv.get('{{holding:1}}')).toBe(1);
    expect(inv.get('{{mention:2}}')).toBe(2);
    expect(inv.get('{{as:opaque:0}}')).toBe(1);
  });

  test('counts note tokens', () => {
    const inv = collectPlaceholderInventory('{{note:0}} and {{note:1}} and {{note:0}}');
    expect(inv.get('{{note:0}}')).toBe(2);
    expect(inv.get('{{note:1}}')).toBe(1);
  });
});

describe('missingPlaceholders', () => {
  test('empty when all present', () => {
    const src = '{{date:0}} {{entity:p1}}';
    expect(missingPlaceholders(src, 'On {{date:0}} saw {{entity:p1}}.')).toEqual([]);
  });

  test('flags a dropped note placeholder', () => {
    const src = '{{date:0}} {{note:0}}';
    expect(missingPlaceholders(src, 'On {{date:0}}.')).toEqual(['{{note:0}}']);
  });
});
