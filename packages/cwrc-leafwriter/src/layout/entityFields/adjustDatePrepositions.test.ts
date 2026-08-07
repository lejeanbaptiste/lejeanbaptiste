import {
  adjustDatePrepositionsInText,
  dayLevelByDateIndex,
} from './adjustDatePrepositions';
import type { DateGlossInput } from './dateGloss';

describe('adjustDatePrepositionsInText', () => {
  const dayLevels = (entries: Array<[number, boolean]>) => new Map(entries);

  test('rewrites In→On before a day-level date', () => {
    expect(
      adjustDatePrepositionsInText('In {{date:0}}, a decree', dayLevels([[0, true]]), 'en'),
    ).toBe('On {{date:0}}, a decree');
  });

  test('rewrites On→In before a month-level date', () => {
    expect(
      adjustDatePrepositionsInText('On {{date:1}} the walls', dayLevels([[1, false]]), 'en'),
    ).toBe('In {{date:1}} the walls');
  });

  test('leaves by / until / before alone', () => {
    expect(
      adjustDatePrepositionsInText('by {{date:0}} he had fled', dayLevels([[0, true]]), 'en'),
    ).toBe('by {{date:0}} he had fled');
    expect(
      adjustDatePrepositionsInText('until {{date:0}}', dayLevels([[0, false]]), 'en'),
    ).toBe('until {{date:0}}');
    expect(
      adjustDatePrepositionsInText('before {{date:0}}', dayLevels([[0, true]]), 'en'),
    ).toBe('before {{date:0}}');
  });

  test('French En↔Le', () => {
    expect(
      adjustDatePrepositionsInText('En {{date:0}}, un édit', dayLevels([[0, true]]), 'fr'),
    ).toBe('Le {{date:0}}, un édit');
    expect(
      adjustDatePrepositionsInText('Le {{date:0}}', dayLevels([[0, false]]), 'fr'),
    ).toBe('En {{date:0}}');
  });

  test('leaves prepositions that are not immediately before the placeholder', () => {
    expect(
      adjustDatePrepositionsInText('In the capital {{date:0}}', dayLevels([[0, true]]), 'en'),
    ).toBe('In the capital {{date:0}}');
  });

  test('dayLevelByDateIndex mirrors gloss day-level', () => {
    const dates = new Map<number, DateGlossInput>([
      [0, { year: 2, month: 5 }],
      [1, { year: 2, month: 6, gz: '癸未' }],
    ]);
    const levels = dayLevelByDateIndex(dates);
    expect(levels.get(0)).toBe(false);
    expect(levels.get(1)).toBe(true);
  });
});
