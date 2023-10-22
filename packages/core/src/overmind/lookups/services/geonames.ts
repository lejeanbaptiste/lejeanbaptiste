import axios from 'axios';
import type { AuthorityLookupResult } from '../../../dialogs/entityLookups/types';
import { log } from './../../../utilities';
import { AuthorityLookupSettings, type AuthorityLookupParams } from './type';

interface Geoname {
  [x: string]: any;
  adminName1: string;
  countryName: string;
  fcodeName?: string;
  geonameId: number;
  toponymName: string;
}

interface GeonamesResults {
  geonames: Geoname[];
  totalResultsCount: number;
}

const baseURL = 'https://secure.geonames.org';
const MAX_HITS = 25; // default: 100;
const timeout = 3_000;

const axiosInstance = axios.create({ baseURL, timeout });

export const find = async (
  { query }: AuthorityLookupParams,
  { username }: AuthorityLookupSettings = {},
) => {
  if (!username || username === '') {
    // throw new Error(
    //   'GEONAME: You must define a username to be able to make requests to Geonames'
    // );
    log.warn('GEONAME: You must define a username to be able to make requests to Geonames');
    return;
  }

  const encodedURI = encodeURIComponent(query);
  const params = new URLSearchParams({ maxRows: MAX_HITS.toString(), q: encodedURI, username });
  const urlQuery = `searchJSON?${params}`;

  const response = await axiosInstance.get<GeonamesResults>(urlQuery).catch((error) => {
    return {
      status: 500,
      statusText: `The request exeeded the timeout (${timeout})`,
      data: undefined,
    };
  });

  if (response.status >= 400) {
    const errorMsg = `
      Something wrong with the call to geonames, possibly a problem with the network or the server.
      HTTP error: ${response.statusText}
    `;
    log.warn(errorMsg);
    return [];
  }

  const data = response.data;
  if (!data) return [];

  const results: AuthorityLookupResult[] = data.geonames.map(
    ({ toponymName, adminName1, countryName, geonameId, fcodeName }) => {
      const state = adminName1 ?? '';
      const description = fcodeName ?? '';
      const name = `${toponymName} ${state} ${countryName ?? ''}`;
      const uri = `https://geonames.org/${geonameId}`;

      return { description, id: uri, name, repository: 'geonames', type: 'place', query, uri };
    },
  );

  return results;
};
