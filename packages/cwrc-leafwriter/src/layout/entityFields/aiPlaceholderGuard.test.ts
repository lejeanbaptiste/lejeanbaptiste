import { missingPlaceholders, collectPlaceholderInventory } from './aiPlaceholderGuard';
import { normalizeAiPlaceholders } from './normalizeAiPlaceholders';

describe('normalizeAiPlaceholders', () => {
  test('repairs smart-quoted date and entity placeholders', () => {
    expect(normalizeAiPlaceholders('{{“date:0}}')).toBe('{{date:0}}');
    expect(normalizeAiPlaceholders('{{“entity:office-1”}}')).toBe('{{entity:office-1}}');
    expect(normalizeAiPlaceholders('{{holding:o1}}')).toBe('{{holding:o1}}');
  });
});

describe('collectPlaceholderInventory', () => {
  test('counts holding/as/entity/date/opaque tokens', () => {
    const text =
      '{{date:0}}以{{holding:o1}}{{entity:p1}}為{{as:opaque:0}}，{{entity:p1}}';
    const inv = collectPlaceholderInventory(text);
    expect(inv.get('{{date:0}}')).toBe(1);
    expect(inv.get('{{holding:o1}}')).toBe(1);
    expect(inv.get('{{entity:p1}}')).toBe(2);
    expect(inv.get('{{as:opaque:0}}')).toBe(1);
  });
});

describe('missingPlaceholders', () => {
  test('empty when all present', () => {
    const src = '{{date:0}} {{entity:p1}}';
    expect(missingPlaceholders(src, 'On {{date:0}} saw {{entity:p1}}.')).toEqual([]);
  });
});
