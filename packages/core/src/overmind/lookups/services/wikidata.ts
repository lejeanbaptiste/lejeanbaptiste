import axios, { AxiosInstance } from 'axios';
import wdk from 'wikidata-sdk';
import { IResult } from '../../../components/entityLookups/types';
import ILookupServiceApi, { IFindParams } from './type';

type NamedEntityType = 'person' | 'place' | 'org' | 'title' | 'rs';

interface IRecord {
  id: string;
  title: string;
  pageid: number;
  repository: string;
  url: string;
  concepturi: string;
  label: string;
  description: string;
  match: {
    type: string;
    language: string;
    text: string;
  };
}

interface IWikidataResults {
  searchinfo: {
    search: string;
  };
  search: IRecord[];
  'search-continue': string;
  success: string;
}

export default class Wikidata implements ILookupServiceApi {
  private readonly axiosInstance: AxiosInstance;
  private readonly baseURL = '';
  private readonly FORMAT = 'json';
  // private readonly MAX_HITS = 20; //defaut: 20
  private readonly LANGUAGE = 'en';
  private readonly timeout = 3_000;

  constructor() {
    this.axiosInstance = axios.create({ baseURL: this.baseURL, timeout: this.timeout });
  }

  async find({ query, type }: IFindParams) {
    if (type === 'person') return await this.callWikidata(query, 'person');
    if (type === 'place') return await this.callWikidata(query, 'place');
    if (type === 'organization') return await this.callWikidata(query, 'org');
    if (type === 'title') return await this.callWikidata(query, 'title');
    if (type === 'rs') return await this.callWikidata(query, 'rs');

    throw new Error('Entity type invalid');
  }

  private async callWikidata(query: string, type: NamedEntityType) {
    const url = wdk.searchEntities({
      search: query,
      format: this.FORMAT,
      language: this.LANGUAGE,
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
      // throw new Error(errorMsg);
      console.warn(errorMsg);
      return [];
    }

    const data: IWikidataResults = response.data;
    if (!data) return [];

    const results: IResult[] = data.search.map(({ concepturi, label, description }) => {
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
