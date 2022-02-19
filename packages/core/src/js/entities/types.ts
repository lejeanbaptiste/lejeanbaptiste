export type IAnnotationFormat = 'xml' | 'json';

interface IAnnotationContextCreated {
  '@type': 'xsd:dateTime'; // string?
  '@id': 'dcterms:created'; // string?
}

interface IAnnotationContextIssued {
  '@type': 'xsd:dateTime'; // string?
  '@id': 'dcterms:issued'; // string?
}

interface IAnnotationContextMotivatedBy {
  '@type': 'oa:Motivation'; // string?
}

interface IAnnotationContext {
  'dcterms:created': IAnnotationContextCreated;
  'dcterms:issued': IAnnotationContextIssued;
  'oa:motivatedBy': IAnnotationContextMotivatedBy;
  '@language': string;
  rdf?: string;
  rdfs?: string;
  as?: string;
  cwrc?: string;
  dc?: string;
  dcterms?: string;
  foaf?: string;
  geo?: string;
  oa?: string;
  schema?: string;
  xsd?: string;
  fabio?: string;
  bf?: string;
  cito?: string;
  org?: string;
  skos?: string;
}

type CreatorType = 'cwrc:NaturalPerson' | 'schema:Person';

export interface IAnnotationCreator {
  '@id': string;
  '@type'?: CreatorType[];
  'cwrc:hasName': string;
  'foaf:nick'?: string;
}

export interface IAnnotationContributor {
  'dcterms:contributor': IAnnotationCreator;
}

interface IAnnotationTargetHasSource {
  '@id': string;
  '@type': 'dctypes:Text'; //string?;
  'dc:format': 'text/xml'; //string?;
}

interface IAnnotationTargetRenderVia {
  '@id': string;
  '@type': 'as:Application'; //string?;
  'rdfs:label': string;
  'schema:softwareVersion': string;
}

interface IAnnotationTargetHasSelectorXpathSelector {
  '@type': 'oa:XPathSelector'; // string?;
  'rdf:value'?: string;
}

interface IAnnotationTargetHasSelectorRefiinedBy {
  '@type': 'oa:TextPositionSelector';
  'oa:start'?: number;
  'oa:end'?: number;
}

interface IAnnotationTargetHasSelector {
  '@id': string;
  '@type': 'oa:XPathSelector' | 'oa:RangeSelector'; //string
  'rdf:value'?: string;
  'oa:hasStartSelector'?: IAnnotationTargetHasSelectorXpathSelector;
  'oa:hasEndSelector'?: IAnnotationTargetHasSelectorXpathSelector;
  'oa:refinedBy'?: IAnnotationTargetHasSelectorRefiinedBy;
}

interface IAnnotationHasTarget {
  '@id': string;
  '@type': 'oa:SpecificResource'; //string?;
  'oa:hasSource': IAnnotationTargetHasSource;
  'oa:renderedVia': IAnnotationTargetRenderVia;
  'oa:hasSelector'?: IAnnotationTargetHasSelector;
}

export interface IAnnotationHasBody {
  '@type'?: string | string[];
  '@id'?: string;
  'dc:format'?: string;
  'rdf:value'?: string;
  'cito:hasCitingEntity'?: string;
  'cito:hasCitedEntity'?: string;
  'cito:hasCitationEvent'?: 'cito:cites'; //string
  'skos:altLabel'?: string;
  'pubType'?: string;
  'xsd:date'?: string;
  'cnt:chars'?: string;
}

interface IAnnotationGenerator {
  '@id': string;
  '@type': 'as:Application'; //string?
  'rdfs:label': 'Leaf Writer'; //string?
  'schema:url': string;
  'schema:softwareVersion': string;
}

export interface IAnnotation {
  '@context': IAnnotationContext;
  id: string;
  type: 'oa:Annotation'; //string?
  'dcterms:created'?: string;
  'dcterms:modified'?: string;
  'dcterms:creator': IAnnotationCreator;
  'oa:motivatedBy': string | string[];
  'oa:hasTarget': IAnnotationHasTarget;
  'oa:hasBody': IAnnotationHasBody | IAnnotationHasBody[];
  'as:generator': IAnnotationGenerator;
  'dcterms:contributor'?: IAnnotationContributor[];
  'cwrc:hasCertainty'?: string;
  'cwrc:hasPrecision'?: string;
}
