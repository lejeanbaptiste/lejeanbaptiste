import { EntityType } from '../../types';
import type { AnnotationCreator } from './types';

export interface AnnotationRange {
  startXPath?: string;
  startOffset?: number;
  endXPath?: string;
  endOffset?: number;
}

// ? This should be really be called annotations?
export interface EntityConfig {
  attributes?: Record<string, any>; //? should we defiine them? Or take from the schema? ! TRY TO MAKE SCHEMA DEPENDENT
  certainty?: string;
  content?: string;
  customValues?: Record<string, any>;
  didUpdate?: boolean;
  dateCreated?: string; //? should we required a proper format? ! YES
  dateModified?: string; //? should we required a proper format? ! YES
  id: string;
  isNamedEntity?: boolean;
  isNote?: boolean;
  lemma?: string;
  noteContent?: string;
  originalData?: Record<string, any>;
  precision?: string;
  range?: AnnotationRange;
  source?: string; //? should we defiined them? Or take from the schema? // PREDEFINE USING AUTHORITIES and 'CUSTOM';
  tag: string;
  type: EntityType; // | string;
  uri?: string;
}

/**
 * @param content
 * @returns {String}
 */
const getTitleFromContent = (content: string, trim = 0) => {
  content = content.trim().replace(/\s+/g, ' ');
  if (trim === 0) return content;
  if (content.length <= trim) return content;
  const title = content.slice(0, trim) + '...';
  return title;
};

const getSourceNameFromUrl = (url: string) => {
  const Url = new URL(url);
  const domain = Url.hostname
    .replace('www.', '')
    .replace('vocab.', '')
    .replace('.edu', '')
    .replace('.org', '');
  // .toUpperCase();
  return domain;
};

/**
 * @class Entity
 * @param {Object} config
 */
class Entity {
  /** Values used to identify the text range of the entity. Mainly set by converter when loading a document. */
  annotationRange: AnnotationRange = {};

  /** Values that can be directly mapped onto the entity's tag.  */
  attributes: any = {};

  /** The text content of the entity. */
  content?: string;

  /** Values that can't be directly mapped onto the entity's tag. */
  customValues: any = {};

  /** When the entity was created. A date in ISO string format */
  dateCreated?: string;

  /** Timestamp when the entity was modified the last time. A date in ISO string format */
  dateModified?: string;

  /** The internal ID of the entity. */
  id: string;

  /** Is the entity named, i.e. does it have a URI */
  _isNamedEntity = false;

  /** Is the entity a note */
  _isNote = false;

  /** XML content, used by note-type entities. */
  noteContent?: string;

  /** The parent tag of the entity.*/
  tag: string;

  /** A label for use when displaying information about the entity. Typically will be a concatenated version of the content. */
  title?: string;

  /** The type of the entity, e.g. person, place, date. */
  type: EntityType;

  // NAMED ENTITY PROPERTIES

  /** The creator of the entity annotation. */
  creator?: AnnotationCreator;

  /** The certainty of the entity annotation. */
  certainty?: string;

  /** The lemma for this entity (usually from a lookup). */
  lemma?: string;

  /** The precision of the entity annotation. Only used on a few entity types */
  precision?: string;

  /** The source associated with this entity URI (usually from a lookup). */
  source?: string;

  /** The URI associated with this entity (usually from a lookup). */
  uri?: string;

  // UTILITIES PROPERTIES

  /** If the entity got updated over the session. */
  _didUpdate = false;

  /** Store original data loaded from XML. */
  _originalData?: any;

  constructor(config: EntityConfig) {
    // SET VALUES FROM CONFIG

    this.id = config.id;
    this.type = config.type as EntityType;
    this.tag = config.tag;

    // DATE CREATED
    if (config.dateCreated) {
      // try setting the date
      const date = new Date(config.dateCreated);

      this.dateCreated = isNaN(date.valueOf())
        ? new Date().toISOString() // invalid date so use now
        : date.toISOString();
    } else if (config?.originalData?.['dcterms:created']) {
      // try setting the date
      const date = new Date(config.originalData['dcterms:created']);

      this.dateCreated = isNaN(date.valueOf())
        ? new Date().toISOString() // invalid date so use now
        : date.toISOString();
    } else {
      this.dateCreated = new Date().toISOString();
    }

    // DATE MODIFIED

    if (config?.dateModified) {
      // try setting the date
      const date = new Date(config.dateModified);

      this.dateCreated = isNaN(date.valueOf())
        ? this.dateCreated // invalid date so use now
        : date.toISOString();
    } else if (config?.originalData?.['dcterms:modified']) {
      // try setting the date
      const date = new Date(config.originalData['dcterms:modified']);

      this.dateCreated = isNaN(date.valueOf())
        ? this.dateCreated // invalid date so use now
        : date.toISOString();
    } else {
      this.dateModified = this.dateCreated;
    }

    if (config.content) this.setContent(config.content);

    if (config.attributes) this.attributes = config.attributes;

    if (config.customValues) this.customValues = config.customValues;

    if (config.noteContent) {
      this.noteContent = config.noteContent;
      this._isNote = true;
    }

    if (config.isNote) this._isNote = config.isNote;

    if (config.range) this.annotationRange = config.range;

    if (config.uri) {
      this.uri = config.uri;
      this._isNamedEntity = true;
    }

    if (config.lemma) this.lemma = config.lemma;

    if (config.certainty) this.certainty = config.certainty;

    if (config.precision) this.precision = config.precision;

    if (config.isNamedEntity) this._isNamedEntity = config.isNamedEntity;

    if (config?.originalData?.['dcterms:creator']) {
      this.creator = config.originalData['dcterms:creator'];
    }

    if (config.didUpdate) this._didUpdate = config.didUpdate;

    if (config.originalData) this._originalData = config.originalData;
  }

  getId() {
    return this.id;
  }
  setId(id: string) {
    this.id = id;
  }

  getType() {
    return this.type;
  }

  isNote() {
    return this._isNote;
  }

  isNamedEntity() {
    return this._isNamedEntity;
  }

  getTag() {
    return this.tag;
  }

  setTag(tag: string) {
    this.tag = tag;
  }

  getContent() {
    return this.content;
  }

  setContent(content: string) {
    this.content = content;
    this.title = getTitleFromContent(this.content, 34);
  }

  getTitle() {
    return this.lemma ? this.lemma : this.title;
  }

  getAttribute(key: string) {
    return this.attributes[key];
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  }

  getAttributes() {
    return this.attributes;
  }

  setAttributes(attObj: any) {
    this.attributes = {};
    for (const key in attObj) {
      this.attributes[key] = attObj[key];
    }
  }

  removeAttribute(name: string) {
    delete this.attributes[name];
  }

  getCustomValue(key: string) {
    return this.customValues?.[key];
  }
  setCustomValue(name: string, value: any) {
    this.customValues[name] = value;
  }

  getCustomValues() {
    return this.customValues;
  }
  setCustomValues(propOjb: any) {
    this.customValues = propOjb;
  }

  removeCustomValue(name: string) {
    delete this.customValues[name];
  }

  setProperty(property: string, value: any) {
    if (this.hasOwnProperty(property)) {
      //@ts-ignore
      this[property] = value;
    }
  }

  getNoteContent() {
    return this.noteContent;
  }
  setNoteContent(content: string) {
    this.noteContent = content;
  }

  getDateCreated() {
    return this.dateCreated;
  }

  getDateModified() {
    return this.dateModified;
  }
  setDateModified(date?: string) {
    this.dateModified = date ? date : new Date().toISOString();
  }

  getURI() {
    return this.uri;
  }
  //? Don't call directly. Use setURIForEntity through the EntitiesManager.
  setURI(uri: string) {
    this.uri = uri;
    this.setSource(uri);
  }

  getSource() {
    return this.uri;
  }
  //? Don't call directly. setUri will update the source
  setSource(uri: string) {
    const source = getSourceNameFromUrl(uri);
    this.source = source;
  }

  getLemma() {
    return this.lemma; //return this.lemma ? this.lemma : this.title;
  }
  //? Don't call directly. Use setLemmaForEntity through the EntitiesManager.
  setLemma(lemma: string) {
    this.lemma = lemma;
  }

  getCertainty() {
    return this.certainty;
  }
  //? Don't call directly. Use setCertaintyForEntity through the EntitiesManager.
  setCertainty(certainty: string) {
    this.certainty = certainty;
  }

  getPrecision() {
    return this.precision;
  }
  //? Don't call directly. Use setPrecisionForEntity through the EntitiesManager.
  setPrecision(precision: string) {
    this.precision = precision;
  }

  getRange() {
    return this.annotationRange;
  }
  setRange(rangeObj: AnnotationRange) {
    this.annotationRange = rangeObj;
  }

  getCreator() {
    return this.creator;
  }
  setCreator(creator: AnnotationCreator) {
    this.creator = creator;
  }

  get didUpdate() {
    return this._didUpdate;
  }
  setDidUpdate(value: boolean) {
    this._didUpdate = value;
  }

  get originalData() {
    return this._originalData;
  }

  clone() {
    const clone = Object.create(Entity.prototype);
    for (const key in this) {
      const prop = this[key];
      if (typeof prop !== 'function') {
        clone[key] = prop;
      }
    }

    clone.dateCreated = new Date().toISOString();

    return clone;
  }
}

export default Entity;
