import { derived } from 'overmind';
import { Context } from '..';
import type {
  AuthorityLookupResult,
  AuthorityServices,
  EntryLink,
  NamedEntityType,
} from '../../types';
import { EntityType } from '../../types';
import { urlRegex } from '../../utilities';
import { lgpn } from '../lookups/services/lgpn';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type State = {
  authorityServices: AuthorityServices;
  isUriValid: boolean;
  manualInput: string;
  query: string;
  results?: Map<string, AuthorityLookupResult[]>;
  selected?: EntryLink;
  typeEntity: EntityType;
  typeLookup: NamedEntityType;
};

export const state: State = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isUriValid: derived((state: State, _rootState: Context['state']) => {
    if (!state.manualInput) return true;
    return urlRegex.test(state.manualInput);
  }),
  manualInput: '',
  query: '',
  typeEntity: 'thing',
  typeLookup: 'thing',
  authorityServices: {
    viaf: {
      entities: { person: true, place: true, organization: true, work: true, thing: true },
      id: 'viaf',
      name: 'VIAF',
      priority: 0,
      serviceSource: 'LINCS',
      serviceType: 'API',
    },
    wikidata: {
      entities: { person: true, place: true, organization: true, work: true, thing: true },
      id: 'wikidata',
      name: 'Wikidata',
      priority: 1,
      serviceSource: 'LINCS',
      serviceType: 'API',
    },
    dbpedia: {
      entities: { person: true, place: true, organization: true, work: true, thing: true },
      id: 'dbpedia',
      name: 'DBpedia',
      priority: 2,
      serviceSource: 'LINCS',
      serviceType: 'API',
    },
    getty: {
      entities: { person: true, place: true },
      id: 'getty',
      name: 'Getty',
      priority: 3,
      serviceSource: 'LINCS',
      serviceType: 'API',
    },
    geonames: {
      entities: { place: true },
      id: 'geonames',
      name: 'Geonames',
      priority: 4,
      serviceSource: 'LINCS',
      serviceType: 'API',
    },
    lincs: {
      entities: { person: true, place: true, organization: true, work: true, thing: true },
      id: 'lincs',
      name: 'Lincs',
      priority: 5,
      serviceSource: 'LINCS',
      serviceType: 'API',
    },
    gnd: {
      entities: { person: true, place: true, organization: true, work: true, thing: true },
      id: 'gnd',
      name: 'GND',
      priority: 6,
      serviceSource: 'LINCS',
      serviceType: 'API',
    },
    lgpn,
  },
};
