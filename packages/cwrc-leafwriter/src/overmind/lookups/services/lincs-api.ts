import { z } from 'zod';
import type {
  Authority,
  AuthorityLookupResult,
  LincsAuthorityService,
  NamedEntityType,
} from '../../../types';
import { log } from '../../../utilities';

const lincsApiAuthoritySources = [
  'DBpedia-All',
  'DBpedia-Event',
  'DBpedia-Organisation',
  'DBpedia-Person',
  'DBpedia-Place',
  'DBpedia-Work',
  'Geonames',
  'Getty-All',
  'Getty-AAT',
  'Getty-TGN',
  'Getty-ULAN',
  'GND-Organisation',
  'GND-Person',
  'GND-Place',
  'GND-Subject',
  'GND-Work',
  'LINCS-All',
  'LINCS-Person',
  'LINCS-Place',
  'LINCS-Work',
  'LINCS-Group',
  'LINCS-Event',
  'VIAF-Bibliographic',
  'VIAF-Corporate',
  'VIAF-Expressions',
  'VIAF-Geographic',
  'VIAF-Personal',
  'VIAF-Works',
  'Wikidata',
] as const;

const lincsApiAuthoritySourcesSchema = z.enum(lincsApiAuthoritySources);
type LINCS_API_AUTHORITY_SOURCE = z.infer<typeof lincsApiAuthoritySourcesSchema>;

const LINCS_API_ReconcileResultSchema = z.array(
  z.object({
    authority: lincsApiAuthoritySourcesSchema,
    matches: z.array(
      z.object({
        description: z.string().optional(),
        label: z.string(),
        uri: z.string().url(),
      }),
    ),
  }),
);

//-----

export const getAuthoritySources = (
  authority: Authority,
  entityType: NamedEntityType,
): LINCS_API_AUTHORITY_SOURCE[] => {
  switch (authority) {
    case 'dbpedia':
      if (entityType === 'person') return ['DBpedia-Person'];
      if (entityType === 'place') return ['DBpedia-Place'];
      if (entityType === 'organization') return ['DBpedia-Organisation'];
      if (entityType === 'work') return ['DBpedia-Work'];
      if (entityType === 'thing') return ['DBpedia-All'];
      // if (entityType === 'concept') return ['DBpedia-All'];
      return ['DBpedia-All'];

    case 'geonames':
      return ['Geonames'];

    case 'getty':
      if (entityType === 'person') return ['Getty-ULAN'];
      if (entityType === 'place') return ['Getty-TGN'];
      if (entityType === 'organization') return ['Getty-All'];
      if (entityType === 'work') return ['Getty-AAT', 'Getty-All'];
      if (entityType === 'thing') return ['Getty-AAT', 'Getty-All'];
      // if (entityType === 'concept') sources = ['Getty-AAT', 'Getty-All'];
      return ['Getty-All'];

    case 'gnd':
      if (entityType === 'person') return ['GND-Person'];
      if (entityType === 'place') return ['GND-Place'];
      if (entityType === 'organization') return ['GND-Organisation'];
      if (entityType === 'work') return ['GND-Work'];
      if (entityType === 'thing') return ['GND-Subject'];
      // if (entityType === 'concept') sources = ['GND-Subject'];
      return ['GND-Subject'];

    case 'lincs':
      if (entityType === 'person') return ['LINCS-Person'];
      if (entityType === 'place') return ['LINCS-Place'];
      if (entityType === 'organization') return ['LINCS-Group'];
      if (entityType === 'work') return ['LINCS-Work'];
      if (entityType === 'thing') return ['LINCS-All'];
      // if (entityType === 'concept') sources = ['LINCS-All'];
      return ['LINCS-All'];

    case 'viaf':
      if (entityType === 'person') return ['VIAF-Personal'];
      if (entityType === 'place') return ['VIAF-Geographic'];
      if (entityType === 'organization') return ['VIAF-Corporate'];
      if (entityType === 'work') return ['VIAF-Bibliographic', 'VIAF-Expressions', 'VIAF-Works'];
      if (entityType === 'thing') return ['VIAF-Expressions', 'VIAF-Works'];
      // if (entityType === 'concept') return ['VIAF-Expressions', 'VIAF-Works'];
      return ['VIAF-Expressions'];

    case 'wikidata':
      return ['Wikidata'];

    default:
      return ['Wikidata'];
  }
};

export const createLincsApiFetcher = ({
  entityType,
  authorities,
  moreResults,
}: {
  entityType: NamedEntityType;
  authorities: LincsAuthorityService[];
  moreResults: boolean;
}) => {
  const authoritiesSources = authorities
    .map(({ id }) => getAuthoritySources(id, entityType))
    .flat();

  return async (query: string) => {
    return await reconcile({ query, entityType, authoritiesSources, moreResults });
  };
};

const reconcile = async ({
  query,
  entityType,
  authoritiesSources,
  moreResults = false,
}: {
  query: string;
  entityType: NamedEntityType;
  authoritiesSources: LINCS_API_AUTHORITY_SOURCE[];
  moreResults?: boolean;
}) => {
  const response = await fetch('https://lincs-api.lincsproject.ca/api/link/reconcile', {
    method: 'POST',
    headers: { accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entity: query,
      authorities: authoritiesSources,
      moreResults,
    }),
  });

  if (!response.ok) {
    log.warn(response.status, response.statusText);
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  const data: unknown = await response.json();
  const validatedData = LINCS_API_ReconcileResultSchema.safeParse(data);

  if (!validatedData.success) {
    const msg = `Data return is invalid or not compatible with LEAF-Writer. Error: ${validatedData.error.errors[0].message}`;
    log.warn(msg, validatedData.error);
    throw new Error(msg);
  }

  const results: Map<Authority, AuthorityLookupResult[]> = new Map();

  validatedData.data.forEach((source) => {
    const authorityName = source.authority.split('-')[0].toLowerCase() as Authority;

    const matches: AuthorityLookupResult[] = source.matches.map(({ description, label, uri }) => {
      return {
        authority: authorityName,
        description: description,
        entityType,
        label,
        query,
        uri,
      };
    });

    results.set(authorityName, matches);
  });

  return results;
};
