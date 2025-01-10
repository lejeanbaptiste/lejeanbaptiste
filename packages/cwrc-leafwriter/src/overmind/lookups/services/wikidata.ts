import axios from 'axios';
import { WBK, type SearchResponse } from 'wikibase-sdk';
import type { AuthorityLookupResult } from '../../../dialogs/entityLookups/types';
import { log } from './../../../utilities';
import { type AuthorityLookupParams } from './type';

type NamedEntityType = 'person' | 'place' | 'org' | 'title' | 'rs';

const wdk = WBK({
  instance: 'https://www.wikidata.org',
  sparqlEndpoint: 'https://query.wikidata.org/sparql',
});

const baseURL = '';
const FORMAT = 'json';
const LANGUAGE = 'en';
const timeout = 3_000;

const axiosInstance = axios.create({ baseURL, timeout });

export const find = async ({ query, type }: AuthorityLookupParams) => {
  if (type === 'person') return await callWikidata(query, 'person');
  if (type === 'place') return await callWikidata(query, 'place');
  if (type === 'organization') return await callWikidata(query, 'org');
  if (type === 'title') return await callWikidata(query, 'title');
  if (type === 'rs') return await callWikidata(query, 'rs');
  if (type === 'thing') return await callWikidata(query, 'rs');
  if (type === 'concept') return await callWikidata(query, 'rs');
};

const callWikidata = async (query: string, type: NamedEntityType) => {
  const url = wdk.searchEntities({
    format: FORMAT,
    language: LANGUAGE,
    search: query,
  });

  const response = await axiosInstance.get<SearchResponse>(url).catch(() => {
    return {
      status: 500,
      statusText: `The request exeeded the timeout (${timeout})`,
      data: undefined,
    };
  });

  if (response.status >= 400) {
    const errorMsg = `
      Something wrong with the call to Wikidata, possibly a problem with the network or the server.
      HTTP error: ${response.statusText}
    `;
    log.warn(errorMsg);
    return [];
  }

  const data = response.data;
  if (!data) return [];

  const results: AuthorityLookupResult[] = data.search.map(({ concepturi, label, description }) => {
    return {
      description,
      id: concepturi,
      name: label,
      repository: 'wikidata',
      query,
      type,
      uri: concepturi,
    };
  });

  return results;
};
