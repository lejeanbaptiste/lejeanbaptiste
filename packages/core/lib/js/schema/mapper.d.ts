import { MappingID } from '../../types';
import Entity from '../entities/Entity';
import Writer from '../Writer';
import type { EntityTypes, IEntityMapping } from './types';
export declare const RESERVED_ATTRIBUTES: Set<string>;
export declare const getAttributeString: (attObj: {
    [x: string]: any;
}) => string;
/**
 * Gets the standard mapping for a tag and attributes.
 * Doesn't close the tag, so that further attributes can be added.
 * @param {Entity} entity The Entity from which to fetch attributes.
 * @param {Boolean} [closeTag] True to close the tag (i.e. add >). Default is true.
 * @returns {String}
 */
export declare const getTagAndDefaultAttributes: (entity: Entity, closeTag?: boolean) => string;
/**
 * Similar to the Mapper.getTagAndDefaultAttributes method but includes the end tag.
 * @param {Entity} entity
 * @returns {Array}
 */
export declare const getDefaultMapping: (entity: Entity) => [string, string];
export declare const xmlToString: (xmlData: Node) => string;
declare class Mapper {
    readonly writer: Writer;
    readonly mappings: Map<string, import("./types").ISchemaMapping>;
    currentMappingsId?: MappingID;
    constructor(writer: Writer);
    /**
     * Loads the mappings for the specified schema.
     * @param schemaMappingsId {String} The schema mapping ID.
     * @returns {Deferred} Deferred object that resolves when the mappings are loaded.
     */
    loadMappings(schemaMappingsId: MappingID): void;
    clearMappings(): void;
    getMappings(): import("./types").ISchemaMapping;
    /**
     * Gets the XML mapping for the specified entity.
     * @param {Entity} entity
     * @returns {Array} An 2 item array of opening and closing tags. If the tag is empty then it will be in the second index.
     */
    getMapping(entity: Entity): string[];
    /**
     * Removes the match entries from the mappingInfo object. Optionally removes the matched elements/attributes themselves.
     * @param {Element} entityElement
     * @param {Object} mappingInfo
     * @param {Boolean} isCWRC
     * @param {String|Array} textTag
     * @param {Boolean} removeMatch
     */
    private cleanupMappings;
    private getValueFromXPath;
    /**
     * Returns the mapping of an element to an entity config object.
     * @param {Element} element The element
     * @param {Boolean} [cleanUp] Whether to remove the elements that got matched by reverse mapping. Default is false.
     * @returns {Object} The entity config object.
     */
    getReverseMapping(element: Element, cleanUp?: boolean): {
        [x: string]: any;
    };
    /**
     * Checks if the tag is for an entity.
     * @param {Element|String} element The tag to check.
     * @returns {String|null} The entity type, or null
     */
    getEntityTypeForTag(element: string | Element): EntityTypes;
    /**
     * Gets the mapping for a property of a specific entity type
     * @param {String} type The entity type
     * @param {String} property The property name
     * @returns {String|undefined} The mapping
     */
    getMappingForProperty(type: EntityTypes, property: string): string;
    /**
     * Gets the attribute name mapping for a property of an entity type, if it exists
     * @param {String} type The entity type
     * @param {String} property The property name
     * @returns {String|undefined} The mapping
     */
    getAttributeForProperty(type: EntityTypes, property: string): string;
    /**
     * Get all the properties for the entity type that have mappings to attributes
     * @param {String} type The entity type
     * @returns {Array}
     */
    getMappedProperties(type: EntityTypes): string[];
    /**
     * If the entity has properties that map to attributes, update the property values with those from the attributes
     * @param {Entity} entity
     */
    updatePropertiesFromAttributes(entity: Entity): void;
    /**
     * Checks if the specified entity type is "a note or note-like".
     * @param {String} type The entity type
     * @returns {Boolean}
     */
    isEntityTypeNote(type?: EntityTypes): boolean;
    /**
     * Checks if the specified entity type is a named entity, i.e. specifies a URI.
     * @param {String} type The entity type
     * @returns {Boolean}
     */
    isNamedEntity(type?: EntityTypes): boolean;
    /**
     * Checks if the specified entity type requires a text selection in order to be tagged
     * @param {String} type The entity type
     * @returns {Boolean}
     */
    doesEntityRequireSelection(type: EntityTypes): boolean;
    /**
     * Converts a tag to an entity
     * @param {Element} tag The tag
     * @param {Boolean} [showEntityDialog] Should the entity dialog be shown after conversion? Default is false
     * @returns {Entity|null} The new entity
     */
    convertTagToEntity(tag: Element, showEntityDialog?: boolean): Entity;
    /**
     * Look for candidate entities inside the passed element
     * @param {Array} [typesToFind] An array of entity types to find, defaults to all types
     * @returns {Object} A map of the entities, organized by type
     */
    findEntities(typesToFind?: string[]): {
        [x: string]: HTMLElement[];
    };
    /**
     * Returns the parent tag for entity when converted to a particular schema.
     * @param {String} type The entity type.
     * @returns {String}
     */
    getParentTag(type: EntityTypes): string;
    /**
     * Returns the text tag (tag containing user-highlighted text) for entity when converted to a particular schema.
     * @param {String} type The entity type.
     * @returns {String}
     */
    getTextTag(type: EntityTypes): string | string[];
    /**
     * Returns the required attributes (atttribute names & values that are always added) for this entity type.
     * @param {String} type The entity type.
     * @returns {Object}
     */
    getRequiredAttributes(type: EntityTypes): {
        [x: string]: string;
    };
    /**
     * Returns the entities mapping for the current schemaMapping
     * @param {String} type The entity type.
     * @returns {Object}
     */
    getEntitiesMapping(): Map<EntityTypes, IEntityMapping>;
    /**
     * Returns the root tags for the current schema.
     * @returns {Array}
     */
    getRootTags(): string[];
    /**
     * Returns the name of the header tag for the current schema.
     * @returns {String}
     */
    getHeaderTag(): string;
    /**
     * Returns the namespace for the current schema.
     * @returns {String}
     */
    getNamespace(): string;
    /**
     * Returns the name for the ID attribute for the current schema.
     * @returns {String}
     */
    getIdAttributeName(): string;
    /**
     * Returns the name for the responsibility attribute for the current schema.
     * @returns {String}
     */
    getResponsibilityAttributeName(): string;
    /**
     * Returns the xpath selector for the RDF parent for the current schema.
     * @returns {String}
     */
    getRdfParentSelector(): string;
    /**
     * Returns the block level elements for the current schema.
     * @returns {Array}
     */
    getBlockLevelElements(): string[];
    /**
     * Returns the attribute names that define whether the tag is an URL.
     * @returns {Array}
     */
    getUrlAttributes(): string[];
}
export default Mapper;
//# sourceMappingURL=mapper.d.ts.map