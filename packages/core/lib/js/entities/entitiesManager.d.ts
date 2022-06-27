import { Bookmark } from 'tinymce';
import Writer from '../Writer';
import Entity, { type IEntityConfig } from './Entity';
interface Iinfo {
    attributes: {
        [x: string]: any;
    };
    properties?: {
        [x: string]: any;
    };
    customValues?: {
        [x: string]: any;
    };
}
interface IEntities {
    [x: string]: Entity;
}
export declare type SortingTypes = 'seq' | 'cat' | 'alpha';
/**
 * @class EntitiesManager
 * @param {Writer} writer
 */
declare class EntitiesManager {
    readonly writer: Writer;
    currentEntity: string | null;
    entities: IEntities;
    constructor(writer: Writer);
    /**
     * Creates and adds an entity to the collection.
     * @fires Writer#entityAdded
     * @param {Object|Entity} config The entity config.
     * @param {Range} [range] If a range is provided, the actual tag is also added
     * @returns {Entity} The newly created Entity
     */
    addEntity(config: IEntityConfig | Entity, range?: Range): Entity;
    /**
     * Edits the entity using the supplied info.
     * @param {Entity} entity The entity
     * @param {Object} info The entity info
     * @param {Object} info.attributes Key/value pairs of attributes
     * @param {Object} info.properties Key/value pairs of Entity properties
     * @param {Object} info.customValues Any additional custom values
     * @returns {Entity} The edited Entity
     */
    editEntity(entity: Entity, info: Iinfo): Entity;
    /**
     * Remove an entity from the collection.
     * ? NB: does not remove any associated tags in the document.
     * @fires Writer#entityRemoved
     * @param {String} id Then entity ID.
     */
    removeEntity(id: string): void;
    /**
     * Gets an entity by its ID.
     * @param {String} id The entity ID.
     * @returns {Entity}
     */
    getEntity(id: string): Entity;
    /**
     * Sets an entity by ID.
     * @param {String} id The entity ID.
     * @param {Entity} entity The entity.
     */
    setEntity(id: string, entity: Entity): void;
    /**
     * Returns a clone of the entity.
     * @param {String} id The entity ID.
     * @returns {Entity}
     */
    cloneEntity(id: string): Entity;
    /**
     * Gets all the entities.
     * @returns {Object}
     */
    getEntities(): IEntities;
    /**
     * Gets all the entities, sorted by a particular method.
     * @param {String} [sortingMethod] Either "seq" (sequential), "cat" (categorical), or "alpha" (alphabetical). Default is "seq".
     * @returns {Array}
     */
    getEntitiesArray(sortingMethod?: SortingTypes): Entity[];
    /**
     * Iterate through all entities.
     * Callback is passed the ID and the Entity as arguments.
     * @param {Function} callback
     */
    eachEntity(callback: any): void;
    /**
     * Gets the currently highlighted entity ID.
     * @returns {String} Entity ID
     */
    getCurrentEntity(): string;
    /**
     * Sets the currently highlighted entity ID.
     * @param {String} entityId
     */
    setCurrentEntity(entityId: string): void;
    /**
     * Gets all the content of the text nodes that the entity surrounds.
     * @param {String} entityId
     * @returns {String} The text content
     */
    getTextContentForEntity(entityId: string): string;
    /**
     * Sets the URI property and corresponding attribute
     * @param {String} entityId
     * @param {String} uri
     */
    setURIForEntity(entityId: string, uri: string): void;
    /**
     * Sets the lemma property and corresponding attribute
     * @param {String} entityId
     * @param {String} lemma
     */
    setLemmaForEntity(entityId: string, lemma: string): void;
    /**
     * Sets the certainty property and corresponding attribute
     * @param {String} entityId
     * @param {String} certainty
     */
    setCertaintyForEntity(entityId: string, certainty: string): void;
    /**
     * Sets the precision property and corresponding attribute
     * @param {String} entityId
     * @param {String} certainty
     */
    setPrecisionForEntity(entityId: string, precision: string): void;
    removeHighlights(): void;
    /**
     * Highlights an entity or removes the highlight from a previously highlighted entity.
     * @fires Writer#entityUnfocused
     * @fires Writer#entityFocused
     * @param {String} [id] The entity ID.
     * @param [bm] TinyMce bookmark
     * @param {Boolean} [doScroll] True to scroll to the entity
     */
    highlightEntity(id?: string, bm?: Bookmark | null, doScroll?: boolean): void;
    /**
     * Check to see if any of the entities overlap.
     * @returns {Boolean}
     */
    doEntitiesOverlap(): boolean;
    /**
     * Removes entities that overlap other entities.
     */
    removeOverlappingEntities(): void;
    /**
     * Converts boundary entities (i.e. entities that overlapped) to tag entities, if possible.
     * TODO review
     */
    convertBoundaryEntitiesToTags(): void;
    /**
     * Removes all the entities.
     */
    reset(): void;
}
export default EntitiesManager;
//# sourceMappingURL=entitiesManager.d.ts.map