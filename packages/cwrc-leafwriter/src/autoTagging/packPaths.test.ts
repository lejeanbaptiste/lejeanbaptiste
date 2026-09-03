import {
  expandAuthorityPackIds,
  AUTHORITY_PACKS,
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
    expect(ui['wikidata-persons-ja']).toBe(false);
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

  it('keeps the Norbert person packs distinct by full label', () => {
    expect(AUTHORITY_PACKS.find((pack) => pack.id === 'norbert-persons')?.label).toBe(
      'Norbert persons',
    );
    expect(AUTHORITY_PACKS.find((pack) => pack.id === 'norbert-person-wrappers')?.label).toBe(
      'Norbert person wrappers',
    );
    expect(AUTHORITY_PACKS.find((pack) => pack.id === 'norbert-wiki-nt')?.label).toBe(
      'Norbert wiki noble titles',
    );
    expect(AUTHORITY_PACKS.find((pack) => pack.id === 'wikidata-places-zh-hant')?.label).toBe(
      'Wikidata places (zh-hant)',
    );
    expect(AUTHORITY_PACKS.find((pack) => pack.id === 'wikidata-places-ja')?.label).toBe(
      'Wikidata places (ja)',
    );
    expect(AUTHORITY_PACKS.find((pack) => pack.id === 'wikidata-places-ja')?.relativePath).toBe(
      'wikidata/place-ja/places.ndjson',
    );
    expect(
      AUTHORITY_PACKS.find((pack) => pack.id === 'wikidata-bdrc-concordance')?.relativePath,
    ).toBe('wikidata/bdrc-wikidata-concordance.ndjson');
  });
});
