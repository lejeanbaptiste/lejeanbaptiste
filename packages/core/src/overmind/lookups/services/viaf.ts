import axios, { AxiosInstance } from 'axios';
import { IResult } from '../../../components/entityLookups/types';
import ILookupServiceApi, { IFindParams } from './type';

type NamedEntityType =
  | 'personalNames'
  | 'geographicNames'
  | 'corporateNames'
  | 'uniformTitleWorks'
  | 'names';

interface IRecordDataMainHeadingsData {
  [x: string]: any;
  text: string;
}

interface IRecordData {
  [x: string]: any;
  nameType: string;
  Document: {
    [x: string]: any;
    '@about': string;
  };
  mainHeadings: {
    [x: string]: any;
    data: IRecordDataMainHeadingsData | IRecordDataMainHeadingsData[];
  };
}

interface IRecord {
  record: {
    recordData: IRecordData;
    recordPacking: string;
    recordSchema: string;
  };
}

interface IVIAFResults {
  searchRetrieveResponse: {
    numberOfRecords: string;
    records: IRecord[];
    resultSetIdleTime: string;
    version: string;
  };
}

export default class Viaf implements ILookupServiceApi {
  private readonly axiosInstance: AxiosInstance;
  private readonly baseURL = 'https://viaf.org/viaf';
  private readonly FORMAT = 'application/json';
  private readonly MAX_HITS = 10; //default: 10
  private readonly timeout = 3_000;

  constructor() {
    this.axiosInstance = axios.create({ baseURL: this.baseURL, timeout: this.timeout });
  }

  async find({ query, type }: IFindParams) {
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
      // throw new Error(errorMsg);
      console.warn(errorMsg);
      return [];
    }
    const data: IVIAFResults = response.data;
    if (!data.searchRetrieveResponse.records) return [];

    const results: IResult[] = data.searchRetrieveResponse.records.map((entry) => {
      const { nameType, Document, mainHeadings } = entry.record.recordData;
      const uri = Document['@about'];

      //? Assumes the first instance of mainHeading
      const name = Array.isArray(mainHeadings.data)
        ? mainHeadings.data[0].text
        : mainHeadings.data.text;

      return { id: uri, name, repository: 'viaf', query, type: nameType, uri };
    });

    return results;
  }
}
