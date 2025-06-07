import { z } from 'zod';
import i18n from '../i18n';
import type { Authority, AuthorityLookupResult, NamedEntityType, SearchFunction } from '../types';
import { log } from '../utilities';

const lincsApiAuthoritySources = [
  'DBpedia-All',
  'DBpedia-Event',
  'DBpedia-Organisation',
  'DBpedia-Person',
  'DBpedia-Place',
  'DBpedia-Work',
  'Geonames',
  'Getty-All',
  'Getty-CONA',
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
      return ['DBpedia-All'];

    case 'geonames':
      return ['Geonames'];

    case 'getty':
      if (entityType === 'person') return ['Getty-ULAN'];
      if (entityType === 'place') return ['Getty-TGN'];
      if (entityType === 'organization') return ['Getty-All'];
      if (entityType === 'work') return ['Getty-AAT', 'Getty-CONA', 'Getty-All'];
      if (entityType === 'thing') return ['Getty-AAT', 'Getty-All'];
      return ['Getty-All'];

    case 'gnd':
      if (entityType === 'person') return ['GND-Person'];
      if (entityType === 'place') return ['GND-Place'];
      if (entityType === 'organization') return ['GND-Organisation'];
      if (entityType === 'work') return ['GND-Work'];
      if (entityType === 'thing') return ['GND-Subject'];
      return ['GND-Subject'];

    case 'lincs':
      if (entityType === 'person') return ['LINCS-Person'];
      if (entityType === 'place') return ['LINCS-Place'];
      if (entityType === 'organization') return ['LINCS-Group'];
      if (entityType === 'work') return ['LINCS-Work'];
      if (entityType === 'thing') return ['LINCS-All'];
      return ['LINCS-All'];

    case 'viaf':
      if (entityType === 'person') return ['VIAF-Personal'];
      if (entityType === 'place') return ['VIAF-Geographic'];
      if (entityType === 'organization') return ['VIAF-Corporate'];
      if (entityType === 'work') return ['VIAF-Bibliographic', 'VIAF-Expressions', 'VIAF-Works'];
      if (entityType === 'thing') return ['VIAF-Expressions', 'VIAF-Works'];
      return ['VIAF-Expressions'];

    case 'wikidata':
      return ['Wikidata'];

    default:
      return ['Wikidata'];
  }
};

interface Options {
  authorityId: Authority;
  isUserAuthenticated?: boolean;
}

export const reconcile: SearchFunction = async ({ query, entityType, options }) => {
  if (!options) {
    throw new Error('No options provided');
  }
  const { authorityId, isUserAuthenticated } = options as Options;

  const authoritiesSources = getAuthoritySources(authorityId, entityType);

  const response = await fetch('https://lincs-api.lincsproject.ca/api/link/reconcile', {
    method: 'POST',
    headers: { accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entity: query,
      authorities: authoritiesSources,
      moreResults: isUserAuthenticated,
    }),
  });

  if (!response.ok) {
    log.warn(response.status, response.statusText);
    const message =
      response.statusText !== '' ? response.statusText : i18n.t('LW.messages.Failed to fetch');
    throw new Error(message, { cause: `${response.status}` });
  }

  const data: unknown = await response.json();
  const validatedData = LINCS_API_ReconcileResultSchema.safeParse(data);

  if (!validatedData.success) {
    const message = `Data return is invalid or not compatible with LEAF-Writer. Error: ${validatedData.error.errors[0].message}`;
    log.warn(message, validatedData.error);
    throw new Error(i18n.t('LW.messages.Failed to fetch'), { cause: validatedData.error });
  }

  const mapResults = new Map<AuthorityLookupResult['uri'], AuthorityLookupResult>();

  validatedData.data.forEach((source) => {
    source.matches.forEach(({ description, label, uri }) => {
      if (mapResults.has(uri)) return;
      const entityReturn: AuthorityLookupResult = {
        description: description,
        label,
        uri,
      };
      mapResults.set(uri, entityReturn);
    });
  });

  const results: AuthorityLookupResult[] = Array.from(mapResults.values());

  return results;
};
