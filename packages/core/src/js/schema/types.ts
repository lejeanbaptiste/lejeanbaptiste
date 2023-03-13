import AnnotationsManager from '../entities/annotationsManager';
import Entity from '../entities/Entity';
import type { AnnotationProps, AnnotationFormat } from '../entities/types';

export interface SchemaMappingProps {
  blockElements: string[]; // Additional block level elements that should be added to TinyMCE
  entities: Map<EntityTypes, EntityMappingProps>; //Entity mappings
  header: string; // The name of the header tag
  headings: string[]; // The name of the heading tags
  id: string; // The name of the ID attribute
  // Listeners to Leaf-Writer events can go here and will subscribe upon mappings load
  listeners: {
    tagAdded: (tag: Element) => void;
    tagEdited: (tag: Element) => void;
    documentLoaded: (success: boolean, body: HTMLElement) => void;
  };
  namespace?: string; // The namespace for documents using this schema
  responsibility: string; // The name of the responsibility attribute
  // The XPath selector for the parent of the RDF data, e.g. /TEI/teiHeader/fileDesc/following-sibling::xenoData
  // Currently there's only support for single separators (/ not //), and an axis on the last element
  rdfParentSelector: string;
  root: string[]; // The name(s) of the root tag(s)
  urlAttributes: string[]; // Attributes that should be treated as URLs by the various Leaf-Writer modules
}

export type EntityTypes =
  | 'citation'
  | 'correction'
  | 'date'
  | 'keyword'
  | 'link'
  | 'note'
  | 'organization'
  | 'place'
  | 'person'
  | 'rs' // ? ORLANDO MIGHT HAVE THIS IN THE NEAR FUTURE
  | 'title';

export interface EntityMappingProps {
  // a function which accepts the AnnotationsManager, an Entity, and a format string (either 'xml' or 'json').
  // It should return an annotation in the specified format (see AnnotationsManager.commonAnnotation)
  annotation: (
    annotationManage: AnnotationsManager,
    entity: Entity,
    format?: AnnotationFormat
  ) => AnnotationProps | void;
  isNote?: boolean; //indicates if the entity is a "note type" (default is false)
  label?: string; // the entity's name
  mapping?: MappingProps; // a map of Entity config properties to XPaths
  mappingFunction?: (entity: Entity) => string[]; // a function which accepts an Entity and returns an array of start and end XML strings to be displayed in the Writer (see Mapper.getDefaultMapping)
  parentTag: string | string[]; // the XML tag(s) that encapsulates the entity, also used to determine if an XML tag is associated with an entity
  requiresSelection?: boolean; //indicates id a text selection is required to add the entity (as opposed to a point in the text) (default is true)
  requiredAttributes?: { [x: string]: string }; // a map of attribute names and values that will be added to every instance of this entity type
  textTag?: string | string[]; // used to specify the tag that contains the text content of the entity, mainly used by notes but also by more complex entity mappings
  types?: string[]; //list of possible values to create annotation
  xpathSelector?: string; // if the entity can have several different parentTags or if several entities share the same parentTag, this selector can help differentiate
}

export interface MappingProps {
  // [x: string]: string;
  certainty?: string;
  customValues?: CustomValuesProps;
  lemma?: string;
  noteContent?: string;
  tag?: string;
  uri?: string;
}

export interface CustomValuesProps {
  // [x: string]: string;
  corrText?: string;
  placeType?: string;
  precision?: string;
  sicText?: string;
  tag?: string;
}
