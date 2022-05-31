import axios, { AxiosInstance } from 'axios';
import type { IResult } from '../../../components/entityLookups/types';
import { log } from './../../../utilities';
import ILookupServiceApi, { IFindParams } from './type';

type NamedEntityType = 'person' | 'place' | 'organisation' | 'work' | 'thing';

interface Doc {
  [x: string]: any;
  comment: string[];
  label: string[];
  resource: string[];
}

interface IDBPedidaResults {
  docs: Doc[];
}

export default class Dbpedia implements ILookupServiceApi {
  private readonly axiosInstance: AxiosInstance;
  private readonly baseURL = 'https://lookup.dbpedia.org/api/search';
  private readonly FORMAT = 'json';
  private readonly MAX_HITS = 25; // default: 100; but it breaks at 45+
  private readonly timeout = 3_000;

  constructor() {
    this.axiosInstance = axios.create({ baseURL: this.baseURL, timeout: this.timeout });
  }

  async find({ query, type }: IFindParams) {
    if (type === 'person') return await this.callDBPedia(query, 'person');
    if (type === 'place') return await this.callDBPedia(query, 'place');
    if (type === 'organization') return await this.callDBPedia(query, 'organisation');
    if (type === 'title') return await this.callDBPedia(query, 'work');
    if (type === 'rs') return await this.callDBPedia(query, 'thing');

    throw new Error('Entity type invalid');
  }

  private async callDBPedia(query: string, type: NamedEntityType) {
    const encodeQueryString = encodeURIComponent(query);

    const params = new URLSearchParams({
      QueryClass: type,
      QueryString: encodeQueryString,
      format: this.FORMAT,
      MaxHits: this.MAX_HITS.toString(),
    });

    const urlQuery = `KeywordSearch?$${params}`;

    const response = await this.axiosInstance.get(urlQuery).catch((error) => {
      return {
        status: 500,
        statusText: `The request exeeded the timeout (${this.timeout})`,
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

    const data: IDBPedidaResults = response.data;
    if (!data) return [];

    // const mapResponse = responseJson.docs.map(
    const results: IResult[] = data.docs.map(({ comment, label, resource }) => {
      //? assuming first instance of description, name and uri;
      const description = comment?.[0] ?? 'No description available';
      const name = label[0].replace(/(<([^>]+)>)/gi, '');
      const uri = resource[0];

      return { description, id: uri, name, repository: 'dbpedia', query, type, uri };
    });

    return results;
  }
}
