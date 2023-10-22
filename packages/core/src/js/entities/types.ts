export type AnnotationFormat = 'xml' | 'json';

interface AnnotationContextCreated {
  '@type': 'xsd:dateTime'; // string?
  '@id': 'dcterms:created'; // string?
}

interface AnnotationContextIssued {
  '@type': 'xsd:dateTime'; // string?
  '@id': 'dcterms:issued'; // string?
}

interface AnnotationContextMotivatedBy {
  '@type': 'oa:Motivation'; // string?
}

interface AnnotationContext {
  'dcterms:created': AnnotationContextCreated;
  'dcterms:issued': AnnotationContextIssued;
  'oa:motivatedBy': AnnotationContextMotivatedBy;
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

export interface AnnotationCreator {
  '@id': string;
  '@type'?: CreatorType[];
  'cwrc:hasName': string;
  'foaf:nick'?: string;
}

export interface AnnotationContributor {
  'dcterms:contributor': AnnotationCreator;
}

interface AnnotationTargetHasSource {
  '@id': string;
  '@type': 'dctypes:Text'; //string?;
  'dc:format': 'text/xml'; //string?;
}

interface AnnotationTargetRenderVia {
  '@id': string;
  '@type': 'as:Application'; //string?;
  'rdfs:label': 'LEAF-Writer';
  'schema:softwareVersion': string;
}

interface AnnotationTargetHasSelectorXpathSelector {
  '@type': 'oa:XPathSelector'; // string?;
  'rdf:value'?: string;
}

interface AnnotationTargetHasSelectorRefiinedBy {
  '@type': 'oa:TextPositionSelector';
  'oa:start'?: number;
  'oa:end'?: number;
}

interface AnnotationTargetHasSelector {
  '@id': string;
  '@type': 'oa:XPathSelector' | 'oa:RangeSelector'; //string
  'rdf:value'?: string;
  'oa:hasStartSelector'?: AnnotationTargetHasSelectorXpathSelector;
  'oa:hasEndSelector'?: AnnotationTargetHasSelectorXpathSelector;
  'oa:refinedBy'?: AnnotationTargetHasSelectorRefiinedBy;
}

interface AnnotationHasTarget {
  '@id': string;
  '@type': 'oa:SpecificResource'; //string?;
  'oa:hasSource': AnnotationTargetHasSource;
  'oa:renderedVia': AnnotationTargetRenderVia;
  'oa:hasSelector'?: AnnotationTargetHasSelector;
}

export interface AnnotationHasBody {
  '@type'?: string | string[];
  '@id'?: string;
  'dc:format'?: string;
  'rdf:value'?: string;
  'cito:hasCitingEntity'?: string;
  'cito:hasCitedEntity'?: string;
  'cito:hasCitationEvent'?: 'cito:cites'; //string
  'skos:altLabel'?: string;
  pubType?: string;
  'xsd:date'?: string;
  'cnt:chars'?: string;
}

interface AnnotationGenerator {
  '@id': string;
  '@type': 'as:Application'; //string?
  'rdfs:label': 'LEAF-Writer'; //string?
  'schema:url': string;
  'schema:softwareVersion': string;
}

export interface AnnotationProps {
  '@context': AnnotationContext;
  id: string;
  type: 'oa:Annotation'; //string?
  'dcterms:created'?: string;
  'dcterms:modified'?: string;
  'dcterms:creator': AnnotationCreator;
  'oa:motivatedBy': string | string[];
  'oa:hasTarget': AnnotationHasTarget;
  'oa:hasBody': AnnotationHasBody | AnnotationHasBody[];
  'as:generator': AnnotationGenerator;
  'dcterms:contributor'?: AnnotationContributor[];
  'cwrc:hasCertainty'?: string;
  'cwrc:hasPrecision'?: string;
}
