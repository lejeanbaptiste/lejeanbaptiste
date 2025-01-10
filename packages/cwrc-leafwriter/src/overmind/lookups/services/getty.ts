import axios from 'axios';
import { type AuthorityLookupResult } from '../../../dialogs/entityLookups/types';
import { log } from './../../../utilities';
import { type AuthorityLookupParams } from './type';

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

const baseURL = 'https://vocab.getty.edu';
const FORMAT = 'json';
const MAX_HITS = 25; // default: unlimited? (over 100)
const timeout = 3_000;

const axiosInstance = axios.create({ baseURL, timeout });

export const find = async ({ query, type }: AuthorityLookupParams) => {
  if (type === 'person') return await callGetty(query, 'ulan');
  if (type === 'place') return await callGetty(query, 'tgn');

  log.warn(`GETTY: Entity type ${type} invalid`);
};

const getEntitySourceURI = (query: string, gettyVocab: NamedEntityType) => {
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
    LIMIT ${MAX_HITS}`);

  return `sparql.${FORMAT}?query=${encodedQuery}`;
};

const callGetty = async (query: string, type: NamedEntityType) => {
  const urlQuery = getEntitySourceURI(query, type);

  const response = await axiosInstance.get<GettyResults>(urlQuery).catch(() => {
    return {
      status: 500,
      statusText: `The request exeeded the timeout (${timeout})`,
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

  const data = response.data;
  if (!data) return [];

  const results: AuthorityLookupResult[] = data.results.bindings.map(
    ({ Subject, Term, ExtraType }) => {
      return {
        description: ExtraType?.value,
        id: Subject.value,
        name: Term.value,
        repository: 'getty',
        type,
        query,
        uri: Subject.value,
      };
    },
  );

  return results;
};
