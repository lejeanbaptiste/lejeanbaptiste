import { normalizeAiPlaceholders } from './normalizeAiPlaceholders';

describe('normalizeAiPlaceholders', () => {
  test('repairs smart-quoted date placeholders', () => {
    expect(normalizeAiPlaceholders('{{“date:0}}')).toBe('{{date:0}}');
    expect(normalizeAiPlaceholders('{{"date:1"}}')).toBe('{{date:1}}');
    expect(normalizeAiPlaceholders("{{'date:2'}}")).toBe('{{date:2}}');
  });

  test('repairs smart-quoted entity placeholders', () => {
    expect(normalizeAiPlaceholders('{{“entity:office-1”}}')).toBe('{{entity:office-1}}');
    expect(normalizeAiPlaceholders('{{entity:"person-1"}}')).toBe('{{entity:person-1}}');
  });

  test('leaves clean placeholders alone', () => {
    expect(normalizeAiPlaceholders('On {{date:0}} {{entity:p1}}')).toBe(
      'On {{date:0}} {{entity:p1}}',
    );
  });
});
