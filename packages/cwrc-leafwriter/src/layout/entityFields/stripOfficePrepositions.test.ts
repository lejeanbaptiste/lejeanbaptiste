import { stripLeadingOfficePrepositionsFromText } from './stripOfficePrepositions';

describe('stripLeadingOfficePrepositionsFromText', () => {
  test('removes Governor of before entity placeholder', () => {
    expect(
      stripLeadingOfficePrepositionsFromText('appointed as Governor of {{entity:office-1}}.'),
    ).toBe('appointed as {{entity:office-1}}.');
  });

  test('removes Prefect of / French Préfet de', () => {
    expect(stripLeadingOfficePrepositionsFromText('Prefect of {{entity:place-1}}')).toBe(
      '{{entity:place-1}}',
    );
    expect(stripLeadingOfficePrepositionsFromText('Préfet de {{entity:office-1}}')).toBe(
      '{{entity:office-1}}',
    );
  });

  test('leaves titles that are not immediately before a placeholder', () => {
    expect(
      stripLeadingOfficePrepositionsFromText('Governor of the province {{entity:office-1}}'),
    ).toBe('Governor of the province {{entity:office-1}}');
  });
});
