/**
 * The "thing" entity kind is wired through four separate lookup tables that
 * must agree with each other: a mismatch here would resolve `<rs>` mentions
 * to the wrong kind, or silently fall back to passthrough (no database row
 * minted) instead of a real lookup. See entities.ts (TAG_TO_KIND),
 * disambiguationCandidates.ts (TAG_TO_ENTITY_TYPE), entity-database-lookup.ts
 * (LOOKUP_TYPE_TO_KIND), and mergedLookupMain.tsx (LOOKUP_TYPE_TO_TAG).
 */
import { ENTITY_KINDS, TAG_TO_KIND } from './entities';
import { TAG_TO_ENTITY_TYPE } from './disambiguationCandidates';
import { LOOKUP_TYPE_TO_KIND } from '../services/entity-database-lookup';

describe('the "thing" kind is consistently wired across the four lookup maps', () => {
  it('has an entry in the master ENTITY_KINDS config', () => {
    expect(ENTITY_KINDS.thing).toMatchObject({ idPrefix: 'thing' });
  });

  it('maps the <rs> mention tag to kind "thing" (TAG_TO_KIND)', () => {
    expect(TAG_TO_KIND.rs).toBe('thing');
  });

  it('maps the <rs> mention tag to lookup type "thing" (TAG_TO_ENTITY_TYPE)', () => {
    expect(TAG_TO_ENTITY_TYPE.rs).toBe('thing');
  });

  it('maps lookup type "thing" to entity kind "thing" — no more passthrough (LOOKUP_TYPE_TO_KIND)', () => {
    expect(LOOKUP_TYPE_TO_KIND.thing).toBe('thing');
  });
});
