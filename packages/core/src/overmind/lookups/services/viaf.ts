import axios from 'axios';
import type { AuthorityLookupResult } from '../../../dialogs/entityLookups/types';
import { log } from './../../../utilities';
import { type AuthorityLookupParams } from './type';

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

const baseURL = 'https://viaf.org/viaf';
const FORMAT = 'application/json';
const MAX_HITS = 10; //default: 10
const timeout = 3_000;

const axiosInstance = axios.create({ baseURL, timeout });

export const find = async ({ query, type }: AuthorityLookupParams) => {
  if (type === 'person') return await callVIAF(query, 'personalNames');
  if (type === 'place') return await callVIAF(query, 'geographicNames');
  if (type === 'organization') return await callVIAF(query, 'corporateNames');
  if (type === 'title') return await callVIAF(query, 'uniformTitleWorks');
  if (type === 'rs') return await callVIAF(query, 'names');
  if (type === 'thing') return await callVIAF(query, 'names');
  if (type === 'concept') return await callVIAF(query, 'names');

  log.warn(`VIAF: Entity type ${type} invalid`);
};

const callVIAF = async (query: string, methodName: NamedEntityType) => {
  const encodedUri = encodeURIComponent(query);

  let urlQuery = 'search?';
  urlQuery += `query=local.${methodName}+all+%22${encodedUri}%22`;
  urlQuery += `&httpAccept=${FORMAT}`;
  // urlQuery += `&maximumRecords=${MAX_HITS}`;

  const response = await axiosInstance.get<VIAFResults>(urlQuery).catch((error) => {
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
  if (!data.searchRetrieveResponse.records) return [];

  const results: AuthorityLookupResult[] = data.searchRetrieveResponse.records.map((entry) => {
    const { nameType, Document, mainHeadings } = entry.record.recordData;
    const uri = Document['@about'];

    //? Assumes the first instance of mainHeading
    const name = Array.isArray(mainHeadings.data)
      ? mainHeadings.data[0]?.text
      : mainHeadings.data.text;

    return { id: uri, name: name ?? '', repository: 'viaf', query, type: nameType, uri };
  });

  return results;
};
