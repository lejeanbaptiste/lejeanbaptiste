import type { Bookmark } from 'tinymce';
import Entity from './entities/Entity';
import type { EntityTypes } from './schema/types';
import Writer from './Writer';
export declare type Action = 'add' | 'before' | 'after' | 'around' | 'inside' | 'change';
/**
 * @class Tagger
 * @param {Writer} writer
 */
declare class Tagger {
    readonly writer: Writer;
    readonly ADD = "add";
    readonly BEFORE = "before";
    readonly AFTER = "after";
    readonly AROUND = "around";
    readonly INSIDE = "inside";
    readonly NO_SELECTION = "no_selection";
    readonly NO_COMMON_PARENT = "no_common_parent";
    readonly OVERLAP = "overlap";
    readonly VALID = "valid";
    constructor(writer: Writer);
    /**
     * Get a tag by id, or get the currently selected tag.
     * @param {String} [id] The id (optional)
     * @returns {jQuery<any>}
     */
    getCurrentTag(id?: string): JQuery<Element>;
    /**
     * Gets the attributes stored in the _attributes holder.
     * @param {Element} tag
     * @returns {Object}
     */
    getAttributesForTag(tag: Element): any;
    /**
     * Adds (non-reserved) attributes to the tag. All attributes get added to the _attributes holder.
     * Overwrites previously set attributes.
     * Assumes the attributes object does not contain CWRC-Writer related attributes, e.g. _tag.
     * @param {Element} tag The tag
     * @param {Object} attributes A name/value map of attributes
     */
    setAttributesForTag(tag: Element, attributes: {
        [x: string]: string;
    }): void;
    /**
     * Similar to setAttributesForTag but doesn't overwrite previously set attributes.
     * @param {Element} tag The tag
     * @param {Object} attributes A name/value map of attributes
     */
    addAttributesToTag(tag: Element, attributes: {
        [x: string]: string;
    }): void;
    /**
     * Remove an attribute from the tag
     * @param {Element} tag The tag
     * @param {String} attribute The attribute name
     */
    removeAttributeFromTag(tag: Element, attributeName: string): void;
    /**
     * Displays the appropriate dialog for adding a tag.
     * @param {String} tagName The tag name.
     * @param {String} tagFullname The tag name.
     * @param {String} action The tag insertion type to perform.
     * @param {String} [parentTagId] The id of the parent tag on which to perform the action. Will use editor selection if not provided.
     */
    addTagDialog({ action, parentTagId, tagFullname, tagName, }: {
        action: Action;
        parentTagId?: string | string[];
        tagFullname?: string;
        tagName: string;
    }): void;
    /**
     * A general edit function for entities and structure tags.
     * @param {String} id The tag id
     */
    editTagDialog(id: string | string[]): void;
    /**
     * A general change/replace function
     * @param {String} tagName The new tag name
     * @param {String} [id] The tag id. If undefined, will get the currently selected tag.
     */
    changeTagDialog(tagName: string, id?: string | string[]): void;
    /**
     * Displays the appropriate dialog for adding an entity
     * @param {String} type The entity type
     * @param {String} [tag] The element name
     */
    addEntityDialog(type: EntityTypes, tag?: string): void;
    /**
     * A general removal function for entities and structure tags
     * @param {String} [id] The id of the tag to remove
     */
    removeTag(id: string): void;
    /**
     * @param {String} id The id of the struct tag or entity to copy
     */
    copyTag(id: string | string[]): void;
    /**
     * Pastes a previously copied tag
     * @fires Writer#contentChanged
     */
    pasteTag(): void;
    /**
     * Split a tag in two based on the current text selection.
     */
    splitTag(): void;
    /**
     * Merge the contents of multiple tags into the first tag.
     * @param {Array} tags An array of tags (Element or jQuery) to merge
     */
    mergeTags(tags: JQuery<HTMLElement>): void;
    /**
     * Process newly added content
     * @param {Element} domContent
     */
    processNewContent(domContent: Element): void;
    /**
     * Add the remaining entity info to its entry
     * @protected
     * @param {String} type Then entity type
     * @param {Object} info The entity info // *IcurrentData at Dialogforms
     */
    finalizeEntity(type: string, info: any): void;
    /**
     * Update the entity info
     * @fires Writer#entityEdited
     * @param {String} id The entity id
     * @param {Object} info The entity info // *IcurrentData at Dialogforms
     * @param {Object} info.attributes Key/value pairs of attributes
     * @param {Object} info.properties Key/value pairs of Entity properties
     * @param {Object} info.customValues Any additional custom values
     */
    editEntity(id: string, info: any): void;
    /**
     * Paste a previously copied entity
     * @fires Writer#entityPasted
     */
    pasteEntity(): void;
    /**
     * Removes the entity annotation and converts the entity back to a tag.
     * @fires Writer#entityRemoved
     * @param {String} entityId
     * @returns {Element} The tag
     */
    removeEntity(entityId?: string | string[]): HTMLElement;
    /**
     * Add an entity tag.
     * @param {Entity} entity The entity to tag
     * @param {Range} range The DOM range to apply the tag to
     */
    addEntityTag(entity: Entity, range: Range): void;
    addNoteWrapper: (tag: Element, type: string) => void;
    addNoteWrappersForEntities(): void;
    removeNoteWrapper(tag: JQuery<HTMLElement>): void;
    removeNoteWrappersForEntities(): void;
    /**
     * Adds a structure tag to the document, based on the params.
     * @fires Writer#tagAdded
     * @param {String} tagName The tag name
     * @param {Object} attributes The tag attributes
     * @param {Object} bookmark A tinymce bookmark object, with an optional custom tagId property
     * @param {String} action Where to insert the tag, relative to the bookmark (before, after, around, inside); can also be null
     * @returns {Element} The new tag
     */
    addStructureTag({ action, attributes, bookmark, tagName, }: {
        action: Action;
        attributes: {
            [x: string]: any;
        };
        bookmark: Bookmark | {
            tagId: string | undefined;
        };
        tagName: string;
    }): HTMLElement;
    /**
     * Change the attributes of a tag, or change the tag itself.
     * @fires Writer#tagEdited
     * @param tag {jQuery} A jQuery representation of the tag
     * @param attributes {Object} An object of attribute names and values
     * @param [tagName] {String} A new tag name for this tag (optional)
     */
    editStructureTag(tag: JQuery<any>, attributes: any, tagName?: string | undefined): void;
    /**
     * Remove a structure tag
     * @fires Writer#tagRemoved
     * @param {String} [id] The tag id
     * @param {Boolean} [removeContents] True to remove tag contents as well
     */
    removeStructureTag(id: string | string[], removeContents?: boolean): void;
    /**
     * Remove a structure tag's contents
     * @fires Writer#tagContentsRemoved
     * @param {String} [id] The tag id
     */
    removeStructureTagContents(id: string | string[]): void;
    /**
     * Look for removed entities
     * @param {Element|Range} domContent
     * @param {Boolean} [processChildren] True to also process the children of domContent. Defaults to true.
     */
    processRemovedContent(domContent: Element | Range, processChildren?: boolean): void;
    /**
     * Converts string values of this object into valid XML strings
     * @param {Object} obj The object of strings/arrays/objects
     * @param {Boolean} isAttributes Are these attributes?
     */
    private sanitizeObject;
    /**
     * Performs a paste using the specified element at the current cursor point
     * @param {Element} element
     */
    private doPaste;
    private showInvalidDeleteConfirm;
    /**
     * Re-select the contents of a node that's been removed
     * @param {jQuery} contents A selection of nodes
     */
    private doReselect;
    /**
     * Checks the user selection for overlap issues and entity markers.
     * @param {Boolean} isStructTag Is the tag a structure tag
     * @param {Boolean} cleanRange True to remove extra whitespace and fix text range that spans multiple parents
     * @returns {Integer}
     */
    private isSelectionValid;
    /**
     * Get the entity boundary tag (and potential inbetween tags) that corresponds to the passed tag.
     * @param {element} tag
     * @returns {jQuery}
     */
    private getCorrespondingEntityTags;
    /**
     * Returns an array of the nodes in between the specified start and end nodes
     * @param {Node} start The start node
     * @param {Node} end The end node
     * @param {NodeFilter} [filter] The NodeFilter, defaults to NodeFilter.SHOW_ALL
     */
    private getNodesInBetween;
}
export default Tagger;
//# sourceMappingURL=tagger.d.ts.map