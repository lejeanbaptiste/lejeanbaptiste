import axios from 'axios';
import type { AuthorityLookupResult } from '../../../dialogs/entityLookups/types';
import { log } from './../../../utilities';
import { type AuthorityLookupParams } from './type';

type NamedEntityType =
  | 'Person'
  | 'PlaceOrGeographicName'
  | 'CorporateBody'
  | 'Work'
  | 'SubjectHeading';

interface Doc {
  id: string;
  preferredName: string;
  biographicalOrHistoricalInformation: string[];
}

interface GNDResults {
  member: Doc[];
}

const baseURL = 'https://lobid.org/gnd';
const FORMAT = 'json';
const MAX_HITS = 25; // default: 100; but it breaks at 45+
const timeout = 3_000;

const axiosInstance = axios.create({ baseURL, timeout });

export const find = async ({ query, type }: AuthorityLookupParams) => {
  if (type === 'person') return await callGND(query, 'Person');
  if (type === 'place') return await callGND(query, 'PlaceOrGeographicName');
  if (type === 'organization') return await callGND(query, 'CorporateBody');
  if (type === 'work') return await callGND(query, 'Work');
  if (type === 'thing') return await callGND(query, 'SubjectHeading');
  if (type === 'concept') return await callGND(query, 'SubjectHeading');
};

const callGND = async (query: string, type: NamedEntityType) => {
  const params = new URLSearchParams({
    q: query,
    filter: 'type:' + type,
    format: FORMAT,
    size: MAX_HITS.toString(),
  });

  const urlQuery = `search?${params}`;

  const response = await axiosInstance.get<GNDResults>(urlQuery).catch(() => {
    return {
      status: 500,
      statusText: `The request exeeded the timeout (${timeout})`,
      data: undefined,
    };
  });

  if (response.status >= 400) {
    const errorMsg = `
      Something wrong with the call to lobid-gnd, possibly a problem with the network or the server.
      HTTP error: ${response.statusText}
    `;
    log.warn(errorMsg);
    return [];
  }

  const data = response.data;
  if (!data) return [];

  // const mapResponse = responseJson.docs.map(
  const results: AuthorityLookupResult[] = data.member.map((entry: Doc) => {
    //? assuming first instance of description, name and uri;
    const description =
      entry.biographicalOrHistoricalInformation?.[0] ?? 'No description available';
    const name = entry.preferredName ?? '';
    const uri = entry.id;

    return { description, id: uri ?? '', name, repository: 'gnd', query, type, uri: uri ?? '' };
  });

  return results;
};
