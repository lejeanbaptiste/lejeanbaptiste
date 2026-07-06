import { canContainForAutoTagging } from './schemaContainment';

describe('canContainForAutoTagging', () => {
  it('allows date in p when persName is allowed but date is not', () => {
    const schema = {
      isTagValidChildOfParent: (child: string, parent: string) =>
        parent === 'p' && child === 'persName',
    };
    expect(canContainForAutoTagging(schema, 'p', 'date')).toBe(true);
    expect(canContainForAutoTagging(schema, 'p', 'persName')).toBe(true);
    expect(canContainForAutoTagging(schema, 'placeName', 'date')).toBe(false);
  });

  it('uses direct schema result when date is already allowed', () => {
    const schema = {
      isTagValidChildOfParent: (child: string, parent: string) =>
        parent === 'p' && (child === 'date' || child === 'persName'),
    };
    expect(canContainForAutoTagging(schema, 'p', 'date')).toBe(true);
  });

  it('strips namespace prefixes before checking', () => {
    const schema = {
      isTagValidChildOfParent: (child: string, parent: string) =>
        parent === 'p' && child === 'persName',
    };
    expect(canContainForAutoTagging(schema, 'tei:p', 'tei:date')).toBe(true);
  });
});
