import Writer from '../Writer';
import Entity, { type IEntityConfig } from './Entity';
import type { IAnnotation, IAnnotationFormat } from './types';
/**
 * @class AnnotationsManager
 * @param {Writer} writer
 */
declare class AnnotationsManager {
    readonly writer: Writer;
    constructor(writer: Writer);
    getAnnotationURIForEntity(entity: Entity): string;
    private checkAnnotationChanges;
    /**
     * Creates a common annotation object.
     * @param {Entity} entity The entity.
     * @param {String|Array} types The annotation body type(s)
     * @param {String|Array} [motivations] The annotation motivation(s). Default is 'oa:identifying'.
     * @returns {JSON}
     */
    commonAnnotation(entity: Entity, types: string | string[], motivations?: string | string[]): IAnnotation;
    /**
     * Get the RDF string that represents the specified annotations.
     * @param {Array} entities An array of Entity instances
     * @param {String} format The annotation format ('xml' or 'json).
     * @returns {String} The RDF string.
     */
    getAnnotations(entities: Entity[], format?: IAnnotationFormat): Promise<string>;
    /**
     * Get the annotation object for the entity.
     * @param {Entity} entity The Entity instance.
     * @returns {JSON} The annotation object.
     */
    getAnnotation(entity: Entity): void | IAnnotation;
    getAnnotationString(entity: Entity, format: IAnnotationFormat): Promise<string>;
    /**
     * Takes a JSON-LD formatted annotation an returns an RDF/XML version.
     * @param {JSON} annotation
     * @param {Function} callback
     * @returns {Promise}
     */
    convertJSONAnnotationToXML(annotation: IAnnotation): string | any;
    /**
     * Gets an entity config for the specified RDF element.
     * @param {Element} rdfEl An RDF element containing annotation info
     * @returns {Object|null} Entity config object
     */
    getEntityConfigFromAnnotation(rdfEl: Element): Partial<IEntityConfig>;
    getEntityConfigFromJsonAnnotation(rdfEl: Element): Partial<IEntityConfig>;
    /**
     * Parse JSON and get an Entity config object
     * @param {Element} rdfEl An RDF element containing JSON text
     * @returns {Object|null} Entity config object
     */
    private getEntityConfigFromJsonAnnotationLegacy;
    /**
     * Parse XML and create a Entity config object
     * @param {Element} xml An RDF element containing XML elements
     * @returns {Object|null} Entity config object
     */
    private getEntityConfigFromXmlAnnotationLegacy;
    /**
     * Returns the entity type, using a annotation string.
     * @param {String} annotation The annotation string, e.g. 'foaf:Person'
     * @returns {String}
     */
    private getEntityTypeForAnnotationLegacy;
    /**
     * Returns the entity type, using a annotation type string.
     * @param {string | string[]} annotationTypes The annotation string, e.g. 'cwrc:NaturalPerson'
     * @returns {string} EntityTypes
     */
    private getEntityTypeForAnnotation;
    /**
     * Gets the range object for xpointer(s).
     * @param {String} xpointerStart
     * @param {String} [xpointerEnd]
     * @return {Object}
     */
    private getRangeObject;
    private parseXPointer;
}
export default AnnotationsManager;
//# sourceMappingURL=annotationsManager.d.ts.map