import axios from 'axios';
import type { AuthorityLookupResult } from '../../../dialogs/entityLookups/types';
import { log } from './../../../utilities';
import { type AuthorityLookupParams } from './type';

type NamedEntityType = 'person' | 'place';

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

const baseURL = 'https://lookup.services.cwrc.ca/lgpn2/cgi-bin';
const FORMAT = 'json';
const timeout = 3_000;

const axiosInstance = axios.create({ baseURL, timeout });

export const find = async ({ query, type }: AuthorityLookupParams) => {
  if (type === 'person') return await callLGPN(query, 'person');
  if (type === 'place') return await callLGPN(query, 'place');

  log.warn(`LGPN: Entity type ${type} invalid`);
};

const callLGPN = async (query: string, type: NamedEntityType) => {
  const encodedQuery = encodeURIComponent(query);

  let urlQuery = `lgpn_search.cgi?`;
  urlQuery += `name=${encodedQuery}`;
  urlQuery += `;style=${FORMAT}`;

  const response = await axiosInstance.get(urlQuery).catch((error) => {
    return {
      status: 500,
      statusText: `The request exeeded the timeout (${timeout})`,
      data: undefined,
    };
  });

  if (response.status >= 400) {
    const errorMsg = `
      Something wrong with the call to LGPN, possibly a problem with the network or the server.
      HTTP error: ${response.statusText}
    `;
    log.warn(errorMsg);
    return [];
  }

  const data = response.data;
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
        description,
        id,
        name,
        repository: 'lgpn',
        uri: `https://www.lgpn.ox.ac.uk/id/${id}`,
        query,
        type,
      };
    },
  );

  return results;
};
