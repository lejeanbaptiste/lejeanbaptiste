import { databaseEntityLabel } from './databaseEntityLabel';
import type { EntitySummary } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityOps';

const entity = (overrides: Partial<EntitySummary>): EntitySummary => ({
  id: 'entity-1',
  kind: 'person',
  names: ['漢字'],
  nameEntries: [],
  romanized: null,
  description: null,
  authorities: [],
  familyName: null,
  givenName: null,
  startYear: null,
  endYear: null,
  workDate: null,
  nationalities: [],
  placesOfOrigin: [],
  authors: [],
  nobleTitles: [],
  roles: [],
  origins: [],
  rejectedCount: 0,
  rejectedAssertions: [],
  rejectedConcordances: [],
  assertions: [],
  ...overrides,
});

describe('databaseEntityLabel', () => {
  it('formats people with Chinese name, Pinyin, and dates', () => {
    expect(databaseEntityLabel(entity({ romanized: 'Hanzi', startYear: 459, endYear: 498 }))).toBe(
      '漢字 Hanzi (459–498)',
    );
  });

  it('formats non-people without dates or an entity key', () => {
    expect(
      databaseEntityLabel(
        entity({ kind: 'office', romanized: 'Taishiling', startYear: 100, endYear: 120 }),
      ),
    ).toBe('漢字 Taishiling');
  });

  it('does not duplicate the name when romanization is identical', () => {
    expect(databaseEntityLabel(entity({ romanized: '漢字' }))).toBe('漢字');
  });
});
