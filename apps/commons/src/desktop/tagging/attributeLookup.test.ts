import { TAG_TO_ENTITY_TYPE } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/disambiguationCandidates';
import { resolveLookupEntityTypeForTag } from './attributeLookupTypes';

describe('resolveLookupEntityTypeForTag', () => {
  it('maps common TEI name tags without needing the schema mapper', () => {
    expect(resolveLookupEntityTypeForTag('persName')).toBe('person');
    expect(resolveLookupEntityTypeForTag('placeName')).toBe('place');
    expect(resolveLookupEntityTypeForTag('orgName')).toBe('organization');
    expect(resolveLookupEntityTypeForTag('org')).toBe('organization');
    expect(resolveLookupEntityTypeForTag('title')).toBe('work');
    expect(resolveLookupEntityTypeForTag('roleName')).toBe('office');
  });

  it('stays aligned with the shared tag map', () => {
    for (const [tag, type] of Object.entries(TAG_TO_ENTITY_TYPE)) {
      expect(resolveLookupEntityTypeForTag(tag)).toBe(type);
    }
  });

  it('falls back to a publishable mapper type for unknown tags', () => {
    expect(resolveLookupEntityTypeForTag('rs', 'thing')).toBe('thing');
  });

  it('returns null for unmarked tags', () => {
    expect(resolveLookupEntityTypeForTag('p')).toBeNull();
    expect(resolveLookupEntityTypeForTag('')).toBeNull();
    expect(resolveLookupEntityTypeForTag('date', 'date')).toBeNull();
  });
});
