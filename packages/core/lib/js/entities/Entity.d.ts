import type { EntityTypes } from '../schema/types';
import type { IAnnotationCreator } from './types';
export interface IannotationRange {
    startXPath?: string;
    startOffset?: number;
    endXPath?: string;
    endOffset?: number;
}
export interface IEntityConfig {
    attributes?: {
        [x: string]: any;
    };
    certainty?: string;
    content?: string;
    customValues?: {
        [x: string]: any;
    };
    didUpdate?: boolean;
    dateCreated?: string;
    dateModified?: string;
    id: string;
    isNamedEntity?: boolean;
    isNote?: boolean;
    lemma?: string;
    noteContent?: string;
    originalData?: {
        [x: string]: any;
    };
    precision?: string;
    range?: IannotationRange;
    source?: string;
    tag: string;
    type: EntityTypes;
    uri?: string;
}
/**
 * @class Entity
 * @param {Object} config
 */
declare class Entity {
    /** Values used to identify the text range of the entity. Mainly set by converter when loading a document. */
    annotationRange: IannotationRange;
    /** Values that can be directly mapped onto the entity's tag.  */
    attributes: any;
    /** The text content of the entity. */
    content?: string;
    /** Values that can't be directly mapped onto the entity's tag. */
    customValues: any;
    /** When the entity was created. A date in ISO string format */
    dateCreated?: string;
    /** Timestamp when the entity was modified the last time. A date in ISO string format */
    dateModified?: string;
    /** The internal ID of the entity. */
    id: string;
    /** Is the entity named, i.e. does it have a URI */
    _isNamedEntity: boolean;
    /** Is the entity a note */
    _isNote: boolean;
    /** XML content, used by note-type entities. */
    noteContent?: string;
    /** The parent tag of the entity.*/
    tag: string;
    /** A label for use when displaying information about the entity. Typically will be a concatenated version of the content. */
    title?: string;
    /** The type of the entity, e.g. person, place, date. */
    type: EntityTypes;
    /** The creator of the entity annotation. */
    creator?: IAnnotationCreator;
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
    /** If the entity got updated over the session. */
    _didUpdate: boolean;
    /** Store original data loaded from XML. */
    _originalData?: any;
    constructor(config: IEntityConfig);
    getId(): string;
    setId(id: string): void;
    getType(): EntityTypes;
    isNote(): boolean;
    isNamedEntity(): boolean;
    getTag(): string;
    setTag(tag: string): void;
    getContent(): string;
    setContent(content: string): void;
    getTitle(): string;
    getAttribute(key: string): any;
    setAttribute(name: string, value: string): void;
    getAttributes(): any;
    setAttributes(attObj: any): void;
    removeAttribute(name: string): void;
    getCustomValue(key: string): any;
    setCustomValue(name: string, value: any): void;
    getCustomValues(): any;
    setCustomValues(propOjb: any): void;
    removeCustomValue(name: string): void;
    setProperty(property: string, value: any): void;
    getNoteContent(): string;
    setNoteContent(content: string): void;
    getDateCreated(): string;
    getDateModified(): string;
    setDateModified(date?: string): void;
    getURI(): string;
    setURI(uri: string): void;
    getSource(): string;
    setSource(uri: string): void;
    getLemma(): string;
    setLemma(lemma: string): void;
    getCertainty(): string;
    setCertainty(certainty: string): void;
    getPrecision(): string;
    setPrecision(precision: string): void;
    getRange(): IannotationRange;
    setRange(rangeObj: IannotationRange): void;
    getCreator(): IAnnotationCreator;
    setCreator(creator: IAnnotationCreator): void;
    get didUpdate(): boolean;
    setDidUpdate(value: boolean): void;
    get originalData(): any;
    clone(): any;
}
export default Entity;
//# sourceMappingURL=Entity.d.ts.map