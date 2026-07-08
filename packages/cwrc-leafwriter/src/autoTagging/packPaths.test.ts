import {
  expandAuthorityPackIds,
  persistedPacksFromUi,
  uiPacksFromPersisted,
  WIKIDATA_PERSON_CHILD_PACK_IDS,
} from './packPaths';

describe('authority pack UI helpers', () => {
  it('expands wikidata-persons to dynasty child packs', () => {
    expect(expandAuthorityPackIds(['dila-persons', 'wikidata-persons'])).toEqual([
      'dila-persons',
      ...WIKIDATA_PERSON_CHILD_PACK_IDS,
    ]);
  });

  it('maps legacy per-dynasty selections to the single UI checkbox', () => {
    const ui = uiPacksFromPersisted(['wikidata-persons-ming', 'cbdb-persons']);
    expect(ui['wikidata-persons']).toBe(true);
    expect(ui['cbdb-persons']).toBe(true);
    expect(ui['wikidata-persons-tang']).toBeUndefined();
  });

  it('persists wikidata-persons without dynasty child ids', () => {
    const ui = uiPacksFromPersisted();
    ui['wikidata-persons'] = true;
    ui['dila-persons'] = true;
    const saved = persistedPacksFromUi(ui);
    expect(saved).toEqual(['dila-persons', 'wikidata-persons']);
    for (const child of WIKIDATA_PERSON_CHILD_PACK_IDS) {
      expect(saved).not.toContain(child);
    }
  });
});
