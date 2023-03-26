import axios, { type AxiosInstance } from 'axios';
import { WBK, type SearchResponse } from 'wikibase-sdk';
import type { LookUpResult } from '../../../dialogs/entityLookups/types';
import { log } from './../../../utilities';
import LookupServiceApi, { type LookUpFindProps } from './type';

type NamedEntityType = 'person' | 'place' | 'org' | 'title' | 'rs';

const wdk = WBK({
  instance: 'https://www.wikidata.org',
  sparqlEndpoint: 'https://query.wikidata.org/sparql',
});

export default class Wikidata implements LookupServiceApi {
  private readonly axiosInstance: AxiosInstance;
  private readonly baseURL = '';
  private readonly FORMAT = 'json';
  // private readonly MAX_HITS = 20; //defaut: 20
  private readonly LANGUAGE = 'en';
  private readonly timeout = 3_000;

  constructor() {
    this.axiosInstance = axios.create({ baseURL: this.baseURL, timeout: this.timeout });
  }

  async find({ query, type }: LookUpFindProps) {
    if (type === 'person') return await this.callWikidata(query, 'person');
    if (type === 'place') return await this.callWikidata(query, 'place');
    if (type === 'organization') return await this.callWikidata(query, 'org');
    if (type === 'title') return await this.callWikidata(query, 'title');
    if (type === 'rs') return await this.callWikidata(query, 'rs');

    throw new Error('Entity type invalid');
  }

  private async callWikidata(query: string, type: NamedEntityType) {
    const url = wdk.searchEntities({
      format: this.FORMAT,
      language: this.LANGUAGE,
      search: query,
      // limit: MAX_HITS,
    });

    const response = await this.axiosInstance.get(url).catch((error) => {
      return {
        status: 500,
        statusText: `The request exeeded the timeout (${this.timeout})`,
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

    const data: SearchResponse = response.data;
    if (!data) return [];

    const results: LookUpResult[] = data.search.map(({ concepturi, label, description }) => {
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
  }
}
