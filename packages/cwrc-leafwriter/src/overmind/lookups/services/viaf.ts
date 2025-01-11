import type { AuthorityLookupResult } from '../../../dialogs/entityLookups/types';
import { log } from '../../../utilities';
import { LINCS_API_ReconcileResultSchema, type AuthorityLookupParams } from './type';

type AuthoritySource =
  | 'VIAF-Bibliographic'
  | 'VIAF-Corporate'
  | 'VIAF-Expressions'
  | 'VIAF-Geographic'
  | 'VIAF-Personal'
  | 'VIAF-Works';

export const find = async ({ query, type }: AuthorityLookupParams) => {
  let sources: AuthoritySource | AuthoritySource[] = 'VIAF-Expressions';

  if (type === 'person') sources = 'VIAF-Personal';
  if (type === 'place') sources = 'VIAF-Geographic';
  if (type === 'organization') sources = 'VIAF-Corporate';
  if (type === 'work') sources = ['VIAF-Bibliographic', 'VIAF-Expressions', 'VIAF-Works'];
  if (type === 'thing') sources = ['VIAF-Expressions', 'VIAF-Works'];
  if (type === 'concept') sources = ['VIAF-Expressions', 'VIAF-Works'];

  sources = Array.isArray(sources) ? sources : [sources];

  const response = await fetch('https://lincs-api.lincsproject.ca/api/link/reconcile', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      entity: query,
      authorities: sources,
    }),
  });

  if (!response.ok) {
    console.error(response);
    const errorMsg = `Something wrong with the call to VIAF via LINCS-API. Possibly a problem with the network or the server. HTTP error: ${response.statusText}`;
    log.warn(errorMsg);

    return [];
  }

  const data: unknown = await response.json();
  const validatedData = LINCS_API_ReconcileResultSchema.safeParse(data);

  if (!validatedData.success) {
    console.error(validatedData.error);
    const errorMsg = `The data return from VIAF via LINCS-API is invalid and not compatible with LEAF-Writer. Error: ${validatedData.error.errors[0].message}`;
    log.warn(errorMsg);

    return [];
  }

  const entries: AuthorityLookupResult[] = [];

  validatedData.data.forEach((source) => {
    const matches: AuthorityLookupResult[] = source.matches.map((match) => {
      return {
        id: match.uri,
        name: match.label,
        query,
        repository: 'viaf',
        type,
        uri: match.uri,
      };
    });

    entries.push(...matches);
  });

  return entries;
};
