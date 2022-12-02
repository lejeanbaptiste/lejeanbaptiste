import axios, { type AxiosInstance } from 'axios';
import { type LookUpResult } from '../../../dialogs/entityLookups/types';
import { log } from './../../../utilities';
import LookupServiceApi, { type LookUpFindProps } from './type';

type NamedEntityType = 'ulan' | 'tgn';

interface GettyAttr {
  type: string;
  value: string;
}

interface Binding {
  [x: string]: any;
  Descr?: GettyAttr;
  ExtraType: GettyAttr;
  Parents: GettyAttr;
  Subject: GettyAttr;
  Term: GettyAttr;
  Type: GettyAttr;
}

interface GettyResults {
  header: {
    vars: string[];
  };
  results: {
    bindings: Binding[];
  };
}

export default class Getty implements LookupServiceApi {
  private readonly axiosInstance: AxiosInstance;

  // * Apparently, we don't need the proxy anymore
  // Calls a cwrc proxy (https://lookup.services.cwrc.ca/getty), so that we can make https calls from the browser.
  // The proxy in turn then calls http://vocab.getty.edu
  // The getty lookup doesn't seem to have an https endpoint
  private readonly baseURL = 'https://vocab.getty.edu';
  private readonly FORMAT = 'json';
  private readonly MAX_HITS = 25; // default: unlimited? (over 100)
  private readonly timeout = 3_000;

  constructor() {
    this.axiosInstance = axios.create({ baseURL: this.baseURL, timeout: this.timeout });
  }

  async find({ query, type }: LookUpFindProps) {
    if (type === 'person') return await this.callGetty(query, 'ulan');
    if (type === 'place') return await this.callGetty(query, 'tgn');

    throw new Error('Entity type invalid');
  }

  private getEntitySourceURI(query: string, gettyVocab: NamedEntityType) {
    const encodedQuery =
      encodeURIComponent(`select ?Subject ?Term ?Parents ?Descr ?ScopeNote ?Type (coalesce(?Type1,?Type2) as ?ExtraType) {
      ?Subject luc:term "${query}"; a ?typ; skos:inScheme ${gettyVocab}:.
      ?typ rdfs:subClassOf gvp:Subject; rdfs:label ?Type.
      filter (?typ != gvp:Subject)
      optional {?Subject gvp:placeTypePreferred [gvp:prefLabelGVP [xl:literalForm ?Type1]]}
      optional {?Subject gvp:agentTypePreferred [gvp:prefLabelGVP [xl:literalForm ?Type2]]}
      optional {?Subject gvp:prefLabelGVP [xl:literalForm ?Term]}
      optional {?Subject gvp:parentStringAbbrev ?Parents}
      optional {?Subject foaf:focus/gvp:biographyPreferred/schema:description ?Descr}
      optional {?Subject skos:scopeNote [dct:language gvp_lang:en; rdf:value ?ScopeNote]}}
      LIMIT ${this.MAX_HITS}`);

    return `sparql.${this.FORMAT}?query=${encodedQuery}`;
  }

  private async callGetty(query: string, type: NamedEntityType) {
    const urlQuery = this.getEntitySourceURI(query, type);

    const response = await this.axiosInstance.get(urlQuery).catch((error) => {
      return {
        status: 500,
        statusText: `The request exeeded the timeout (${this.timeout})`,
        data: undefined,
      };
    });

    if (response.status >= 400) {
      const errorMsg = `
        Something wrong with the call to Getty, possibly a problem with the network or the server.
        HTTP error: ${response.statusText}
      `;
      log.warn(errorMsg);
      return [];
    }

    const data: GettyResults = response.data;
    if (!data) return [];

    const results: LookUpResult[] = data.results.bindings.map(({ Subject, Term, ExtraType }) => {
      return {
        description: ExtraType?.value,
        id: Subject.value,
        name: Term.value,
        repository: 'getty',
        type,
        query,
        uri: Subject.value,
      };
    });

    return results;
  }
}
