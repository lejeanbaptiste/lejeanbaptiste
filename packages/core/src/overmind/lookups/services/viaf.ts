import axios, { type AxiosInstance } from 'axios';
import type { LookUpResult } from '../../../dialogs/entityLookups/types';
import { log } from './../../../utilities';
import LookupServiceApi, { type LookUpFindProps } from './type';

type NamedEntityType =
  | 'personalNames'
  | 'geographicNames'
  | 'corporateNames'
  | 'uniformTitleWorks'
  | 'names';

interface RecordDataMainHeadingsData {
  [x: string]: any;
  text: string;
}

interface RecordData {
  [x: string]: any;
  nameType: string;
  Document: {
    [x: string]: any;
    '@about': string;
  };
  mainHeadings: {
    [x: string]: any;
    data: RecordDataMainHeadingsData | RecordDataMainHeadingsData[];
  };
}

interface Record {
  record: {
    recordData: RecordData;
    recordPacking: string;
    recordSchema: string;
  };
}

interface VIAFResults {
  searchRetrieveResponse: {
    numberOfRecords: string;
    records: Record[];
    resultSetIdleTime: string;
    version: string;
  };
}

export default class Viaf implements LookupServiceApi {
  private readonly axiosInstance: AxiosInstance;
  private readonly baseURL = 'https://viaf.org/viaf';
  private readonly FORMAT = 'application/json';
  // private readonly MAX_HITS = 10; //default: 10
  private readonly timeout = 3_000;

  constructor() {
    this.axiosInstance = axios.create({ baseURL: this.baseURL, timeout: this.timeout });
  }

  async find({ query, type }: LookUpFindProps) {
    if (type === 'person') return await this.callVIAF(query, 'personalNames');
    if (type === 'place') return await this.callVIAF(query, 'geographicNames');
    if (type === 'organization') return await this.callVIAF(query, 'corporateNames');
    if (type === 'title') return await this.callVIAF(query, 'uniformTitleWorks');
    if (type === 'rs') return await this.callVIAF(query, 'names');

    throw new Error('Entity type invalid');
  }

  private async callVIAF(query: string, methodName: NamedEntityType) {
    const encodedUri = encodeURIComponent(query);

    let urlQuery = 'search?';
    urlQuery += `query=local.${methodName}+all+%22${encodedUri}%22`;
    urlQuery += `&httpAccept=${this.FORMAT}`;
    // urlQuery += `&maximumRecords=${MAX_HITS}`;

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
    const data: VIAFResults = response.data;
    if (!data.searchRetrieveResponse.records) return [];

    const results: LookUpResult[] = data.searchRetrieveResponse.records.map((entry) => {
      const { nameType, Document, mainHeadings } = entry.record.recordData;
      const uri = Document['@about'];

      //? Assumes the first instance of mainHeading
      const name = Array.isArray(mainHeadings.data)
        ? mainHeadings.data[0]?.text
        : mainHeadings.data.text;

      return { id: uri, name: name ?? '', repository: 'viaf', query, type: nameType, uri };
    });

    return results;
  }
}
