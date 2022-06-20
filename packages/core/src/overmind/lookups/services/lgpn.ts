import axios, { type AxiosInstance } from 'axios';
import type { IResult } from '../../../components/entityLookups/types';
import { log } from './../../../utilities';
import ILookupServiceApi, { type IFindParams } from './type';

type NamedEntityType = 'person' | 'place';

interface Person {
  id: string;
  name: string;
  place: string;
  notBefore: string;
  notAfter: string;
}

interface ILGPNResults {
  persons: Person[];
}

export default class Lgpn implements ILookupServiceApi {
  private readonly axiosInstance: AxiosInstance;
  private readonly baseURL = 'https://lookup.services.cwrc.ca/lgpn2/cgi-bin';
  private readonly FORMAT = 'json';
  private readonly timeout = 3_000;

  constructor() {
    this.axiosInstance = axios.create({ baseURL: this.baseURL, timeout: this.timeout });
  }

  async find({ query, type }: IFindParams) {
    if (type === 'person') return await this.callLGPN(query, 'person');
    if (type === 'place') return await this.callLGPN(query, 'place');

    throw new Error('Entity type invalid');
  }

  private async callLGPN(query: string, type: NamedEntityType) {
    const encodedQuery = encodeURIComponent(query);
    // const urlQuery = `lgpn_search.cgi?name=${encodedQuery};style=${FORMAT}`;

    let urlQuery = `lgpn_search.cgi?`;
    urlQuery += `name=${encodedQuery}`;
    urlQuery += `;style=${this.FORMAT}`;

    const response = await this.axiosInstance.get(urlQuery).catch((error) => {
      return {
        status: 500,
        statusText: `The request exeeded the timeout (${this.timeout})`,
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
    const dataObj: ILGPNResults = JSON.parse(substr);

    if (dataObj.persons.length === 0) return [];

    const results: IResult[] = dataObj.persons.map(({ id, name, place, notBefore, notAfter }) => {
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
    });

    return results;
  }
}
