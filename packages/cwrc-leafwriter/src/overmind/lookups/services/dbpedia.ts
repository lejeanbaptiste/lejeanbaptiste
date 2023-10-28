import axios from 'axios';
import type { AuthorityLookupResult } from '../../../dialogs/entityLookups/types';
import { log } from './../../../utilities';
import { type AuthorityLookupParams } from './type';

type NamedEntityType = 'person' | 'place' | 'organisation' | 'work' | 'thing';

interface Doc {
  [x: string]: any;
  comment: string[];
  label: string[];
  resource: string[];
}

interface DBPedidaResults {
  docs: Doc[];
}

const baseURL = 'https://lookup.dbpedia.org/api/search';
const FORMAT = 'json';
const MAX_HITS = 25; // default: 100; but it breaks at 45+
const timeout = 3_000;

const axiosInstance = axios.create({ baseURL, timeout });

export const find = async ({ query, type }: AuthorityLookupParams) => {
  if (type === 'person') return await callDBPedia(query, 'person');
  if (type === 'place') return await callDBPedia(query, 'place');
  if (type === 'organization') return await callDBPedia(query, 'organisation');
  if (type === 'title') return await callDBPedia(query, 'work');
  if (type === 'rs') return await callDBPedia(query, 'thing');
  if (type === 'thing') return await callDBPedia(query, 'thing');
  if (type === 'concept') return await callDBPedia(query, 'thing');

  log.warn(`DBPEDIA: Entity type ${type} invalid`);
};

const callDBPedia = async (query: string, type: NamedEntityType) => {
  const encodeQueryString = encodeURIComponent(query);

  const params = new URLSearchParams({
    QueryClass: type,
    QueryString: encodeQueryString,
    format: FORMAT,
    MaxHits: MAX_HITS.toString(),
  });

  const urlQuery = `KeywordSearch?$${params}`;

  const response = await axiosInstance.get<DBPedidaResults>(urlQuery).catch((error) => {
    return {
      status: 500,
      statusText: `The request exeeded the timeout (${timeout})`,
      data: undefined,
    };
  });

  if (response.status >= 400) {
    const errorMsg = `
      Something wrong with the call to DBPedia, possibly a problem with the network or the server.
      HTTP error: ${response.statusText}
    `;
    log.warn(errorMsg);
    return [];
  }

  const data = response.data;
  if (!data) return [];

  // const mapResponse = responseJson.docs.map(
  const results: AuthorityLookupResult[] = data.docs.map(({ comment, label, resource }) => {
    //? assuming first instance of description, name and uri;
    const description = comment?.[0] ?? 'No description available';
    const name = label[0]?.replace(/(<([^>]+)>)/gi, '') ?? '';
    const uri = resource[0];

    return { description, id: uri ?? '', name, repository: 'dbpedia', query, type, uri: uri ?? '' };
  });

  return results;
};
