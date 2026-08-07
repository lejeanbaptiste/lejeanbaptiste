import { stripLeadingDatePrepositionsFromText } from './stripDatePrepositions';

describe('stripLeadingDatePrepositionsFromText', () => {
  test('removes In/On immediately before {{date:N}}', () => {
    expect(stripLeadingDatePrepositionsFromText('In {{date:0}}, a decree')).toBe(
      '{{date:0}}, a decree',
    );
    expect(stripLeadingDatePrepositionsFromText('On {{date:1}} Chen')).toBe('{{date:1}} Chen');
  });

  test('removes French prepositions', () => {
    expect(stripLeadingDatePrepositionsFromText('En {{date:0}}, un édit')).toBe(
      '{{date:0}}, un édit',
    );
    expect(stripLeadingDatePrepositionsFromText('Le {{date:0}}')).toBe('{{date:0}}');
  });

  test('leaves prepositions that are not immediately before the placeholder', () => {
    expect(stripLeadingDatePrepositionsFromText('In the capital {{date:0}}')).toBe(
      'In the capital {{date:0}}',
    );
  });
});
