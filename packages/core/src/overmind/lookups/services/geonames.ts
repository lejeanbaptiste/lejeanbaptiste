import axios, { type AxiosInstance } from 'axios';
import type { IResult } from '../../../components/entityLookups/types';
import { log } from './../../../utilities';
import ILookupServiceApi, { type IFindParams } from './type';

interface Geoname {
  [x: string]: any;
  adminName1: string;
  countryName: string;
  fcodeName?: string;
  geonameId: number;
  toponymName: string;
}

interface IGeonamesResults {
  geonames: Geoname[];
  totalResultsCount: number;
}

export default class Geonames implements ILookupServiceApi {
  private readonly axiosInstance: AxiosInstance;
  private readonly baseURL = 'https://secure.geonames.org';
  private readonly MAX_HITS = 25; // default: 100;
  private readonly timeout = 3_000;
  private readonly username: string;

  constructor(config: any) {
    if (!config?.username || config?.username === '') {
      // throw new Error('You must define a username to be able to make requests to Geonames');
      log.warn('GEONAME: You must define a username to be able to make requests to Geonames');
      return;
    }
    this.username = config.username;
    this.axiosInstance = axios.create({ baseURL: this.baseURL, timeout: this.timeout });
  }

  async find({ query }: IFindParams) {
    return await this.callGeonames(query);
  }

  private async callGeonames(query: string) {
    const encodedURI = encodeURIComponent(query);

    const params = new URLSearchParams({
      q: encodedURI,
      username: this.username,
      maxRows: this.MAX_HITS.toString(),
    });

    const urlQuery = `searchJSON?$${params}`;

    const response = await this.axiosInstance.get(urlQuery).catch((error) => {
      return {
        status: 500,
        statusText: `The request exeeded the timeout (${this.timeout})`,
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

    const data: IGeonamesResults = response.data;
    if (!data) return [];

    const results: IResult[] = data.geonames.map(
      ({ toponymName, adminName1, countryName, geonameId, fcodeName }) => {
        const state = adminName1 ?? '';
        const description = fcodeName ?? '';
        const name = `${toponymName} ${state} ${countryName ?? ''}`;
        const uri = `https://geonames.org/${geonameId}`;

        return { description, id: uri, name, repository: 'geonames', type: 'place', query, uri };
      }
    );

    return results;
  }
}
