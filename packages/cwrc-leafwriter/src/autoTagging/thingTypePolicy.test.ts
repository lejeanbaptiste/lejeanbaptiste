import { validateCustomThingTypeId } from './thingTypePolicy';

describe('validateCustomThingTypeId', () => {
  it('accepts a well-formed ASCII slug', () => {
    expect(validateCustomThingTypeId('philosophical_concept')).toBeNull();
    expect(validateCustomThingTypeId('medicinal-plant')).toBeNull();
    expect(validateCustomThingTypeId('bibliographiccategory')).toBeNull();
  });

  it('rejects a slug that does not match [a-z][a-z0-9_-]*', () => {
    expect(validateCustomThingTypeId('Medicinal Plant')).toBe('invalid_slug');
    expect(validateCustomThingTypeId('medicinalPlant')).toBe('invalid_slug');
    expect(validateCustomThingTypeId('1concept')).toBe('invalid_slug');
    expect(validateCustomThingTypeId('')).toBe('invalid_slug');
  });

  it('rejects the reserved id "thing"', () => {
    expect(validateCustomThingTypeId('thing')).toBe('reserved');
  });
});
