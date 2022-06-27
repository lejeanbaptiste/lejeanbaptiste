import AnnotationsManager from '../entities/annotationsManager';
import Entity from '../entities/Entity';
import type { IAnnotation, IAnnotationFormat } from '../entities/types';
export interface ISchemaMapping {
    blockElements: string[];
    entities: Map<EntityTypes, IEntityMapping>;
    header: string;
    id: string;
    listeners: {
        tagAdded: (tag: Element) => void;
        tagEdited: (tag: Element) => void;
        documentLoaded: (success: boolean, body: HTMLElement) => void;
    };
    namespace?: string;
    responsibility: string;
    rdfParentSelector: string;
    root: string[];
    urlAttributes: string[];
}
export declare type EntityTypes = 'citation' | 'correction' | 'date' | 'keyword' | 'link' | 'note' | 'organization' | 'place' | 'person' | 'rs' | 'title';
export interface IEntityMapping {
    annotation: (annotationManage: AnnotationsManager, entity: Entity, format?: IAnnotationFormat) => IAnnotation | void;
    isNote?: boolean;
    label?: string;
    mapping?: Imapping;
    mappingFunction?: (entity: Entity) => string[];
    parentTag: string | string[];
    requiresSelection?: boolean;
    requiredAttributes?: {
        [x: string]: string;
    };
    textTag?: string | string[];
    types?: string[];
    xpathSelector?: string;
}
export interface Imapping {
    certainty?: string;
    customValues?: CustomValuesProps;
    lemma?: string;
    noteContent?: string;
    tag?: string;
    uri?: string;
}
export interface CustomValuesProps {
    corrText?: string;
    placeType?: string;
    precision?: string;
    sicText?: string;
    tag?: string;
}
//# sourceMappingURL=types.d.ts.map