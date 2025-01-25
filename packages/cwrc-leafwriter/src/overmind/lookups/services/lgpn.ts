import type {
  AuthorityLookupParams,
  AuthorityLookupResult,
} from '../../../dialogs/entityLookups/types';
import { log } from './../../../utilities';

interface Person {
  id: string;
  name: string;
  place: string;
  notBefore: string;
  notAfter: string;
}

interface LGPNResults {
  persons: Person[];
}

export const lgpnService = {
  find: async ({ query, type }: AuthorityLookupParams) => {
    const encodedQuery = encodeURIComponent(query);

    const response = await fetch(
      `https://lookup.services.cwrc.ca/lgpn2/cgi-bin/urlQuery.cgi?name=${encodedQuery};style=json`,
      {
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      log.warn(response.status, response.statusText);
      throw new Error(`${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data) return [];

    //find the result object
    const start = data.indexOf('{');
    const end = data.lastIndexOf(');');
    const substr = data.substring(start, end);
    const dataObj: LGPNResults = JSON.parse(substr);

    if (dataObj.persons.length === 0) return [];

    const results: AuthorityLookupResult[] = dataObj.persons.map(
      ({ id, name, place, notBefore, notAfter }) => {
        const description = `Place: ${place}<br/>Floruit: ${notBefore} to ${notAfter}`;
        return {
          authority: 'lgpn',
          description,
          entityType: type,
          label: name,
          query,
          uri: `https://www.lgpn.ox.ac.uk/id/${id}`,
        };
      },
    );

    return results;
  },
};
