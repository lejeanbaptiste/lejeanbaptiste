import $ from 'jquery';
import { log } from './../../utilities';
import Entity from './Entity';
/**
 * @class EntitiesManager
 * @param {Writer} writer
 */
class EntitiesManager {
    writer;
    currentEntity = null;
    entities = {};
    constructor(writer) {
        this.writer = writer;
        this.reset();
        this.writer.event('processingDocument').subscribe(() => this.reset());
        this.writer.event('entityAdded').subscribe((entityId) => {
            // don't highlight the entity because we might be doing bulk additions
            // this.highlightEntity(entityId);
        });
        this.writer.event('entityEdited').subscribe((entityId) => {
            // don't highlight the entity because it will move the cursor outside of the entity when the user is editing
            // this.highlightEntity(entityId);
        });
        this.writer.event('entityRemoved').subscribe((entityId) => this.highlightEntity());
        this.writer.event('entityPasted').subscribe((entityId) => {
            this.highlightEntity(entityId);
        });
    }
    /**
     * Creates and adds an entity to the collection.
     * @fires Writer#entityAdded
     * @param {Object|Entity} config The entity config.
     * @param {Range} [range] If a range is provided, the actual tag is also added
     * @returns {Entity} The newly created Entity
     */
    addEntity(config, range) {
        let entity;
        if (config instanceof Entity) {
            entity = config;
        }
        else {
            if (!config.id)
                config.id = this.writer.getUniqueId('dom_');
            if (!config.tag) {
                config.tag = this.writer.schemaManager.mapper.getParentTag(config.type);
            }
            entity = new Entity(config);
        }
        const requiredAttributes = this.writer.schemaManager.mapper.getRequiredAttributes(config.type);
        for (const attName in requiredAttributes) {
            entity.setAttribute(attName, requiredAttributes[attName]);
        }
        this.writer.schemaManager.mapper.updatePropertiesFromAttributes(entity);
        if (range)
            this.writer.tagger.addEntityTag(entity, range);
        if (!entity.getContent())
            entity.setContent(this.getTextContentForEntity(entity.id));
        this.entities[entity.id] = entity;
        this.writer.event('entityAdded').publish(entity.id);
        return entity;
    }
    /**
     * Edits the entity using the supplied info.
     * @param {Entity} entity The entity
     * @param {Object} info The entity info
     * @param {Object} info.attributes Key/value pairs of attributes
     * @param {Object} info.properties Key/value pairs of Entity properties
     * @param {Object} info.customValues Any additional custom values
     * @returns {Entity} The edited Entity
     */
    editEntity(entity, info) {
        if (info?.properties?.type !== entity.getType()) {
            // changing type, remove old requiredAttributes
            const requiredAttributes = this.writer.schemaManager.mapper.getRequiredAttributes(entity.getType());
            for (const attName in requiredAttributes) {
                entity.removeAttribute(attName);
            }
        }
        // set attributes
        entity.setAttributes(info.attributes);
        // set properties
        if (info.properties) {
            for (const key in info.properties) {
                entity.setProperty(key, info.properties[key]);
            }
        }
        this.writer.schemaManager.mapper.updatePropertiesFromAttributes(entity);
        // type might have changed so need to set these
        const requiredAttributes = this.writer.schemaManager.mapper.getRequiredAttributes(entity.getType());
        for (const attName in requiredAttributes) {
            entity.setAttribute(attName, requiredAttributes[attName]);
        }
        // set custom values
        for (const key in info.customValues) {
            entity.setCustomValue(key, info.customValues[key]);
        }
        //update modified date
        entity.setDateModified();
        entity.setDidUpdate(true);
        return entity;
    }
    /**
     * Remove an entity from the collection.
     * ? NB: does not remove any associated tags in the document.
     * @fires Writer#entityRemoved
     * @param {String} id Then entity ID.
     */
    removeEntity(id) {
        if (this.entities[id] !== undefined) {
            delete this.entities[id];
            this.writer.event('entityRemoved').publish(id);
        }
    }
    /**
     * Gets an entity by its ID.
     * @param {String} id The entity ID.
     * @returns {Entity}
     */
    getEntity(id) {
        return this.entities[id];
    }
    /**
     * Sets an entity by ID.
     * @param {String} id The entity ID.
     * @param {Entity} entity The entity.
     */
    setEntity(id, entity) {
        entity instanceof Entity
            ? (this.entities[id] = entity)
            : log.warn('entitiesManager: trying to set a non-Entity object.');
    }
    /**
     * Returns a clone of the entity.
     * @param {String} id The entity ID.
     * @returns {Entity}
     */
    cloneEntity(id) {
        const clone = this.entities[id].clone();
        clone.id = this.writer.getUniqueId('dom_');
        // TODO get new URIs
        return clone;
    }
    /**
     * Gets all the entities.
     * @returns {Object}
     */
    getEntities() {
        return this.entities;
    }
    /**
     * Gets all the entities, sorted by a particular method.
     * @param {String} [sortingMethod] Either "seq" (sequential), "cat" (categorical), or "alpha" (alphabetical). Default is "seq".
     * @returns {Array}
     */
    getEntitiesArray(sortingMethod = 'seq') {
        let sortedEntities = [];
        if (sortingMethod === 'cat') {
            const entArray = Object.values(this.entities);
            const categories = {};
            entArray.forEach((entry) => {
                const type = entry.getType();
                if (!type)
                    return;
                if (!categories[type])
                    categories[type] = [];
                categories[type].push(entry);
            });
            for (const type in categories) {
                const category = categories[type];
                for (const entry of category) {
                    sortedEntities.push(entry);
                }
            }
            return sortedEntities;
        }
        if (sortingMethod === 'alpha') {
            sortedEntities = Object.values(this.entities).sort((a, b) => {
                const charA = a.getTitle()?.charAt(0).toLowerCase() ?? '';
                const charB = b.getTitle()?.charAt(0).toLowerCase() ?? '';
                if (charA < charB)
                    return -1;
                if (charA > charB)
                    return 1;
                return 0;
            });
            return sortedEntities;
        }
        const entityTags = $('[_entity][class~=start]', this.writer.editor.getBody()); // sequential ordering
        entityTags.each((index, element) => {
            const entry = this.getEntity($(element).attr('name') ?? '');
            if (entry)
                sortedEntities.push(entry);
        });
        return sortedEntities;
    }
    /**
     * Iterate through all entities.
     * Callback is passed the ID and the Entity as arguments.
     * @param {Function} callback
     */
    eachEntity(callback) {
        $.each(this.entities, callback);
    }
    /**
     * Gets the currently highlighted entity ID.
     * @returns {String} Entity ID
     */
    getCurrentEntity() {
        return this.currentEntity;
    }
    /**
     * Sets the currently highlighted entity ID.
     * @param {String} entityId
     */
    setCurrentEntity(entityId) {
        this.currentEntity = entityId;
    }
    /**
     * Gets all the content of the text nodes that the entity surrounds.
     * @param {String} entityId
     * @returns {String} The text content
     */
    getTextContentForEntity(entityId) {
        let entityTextContent = '';
        $(`[name=${entityId}]`, this.writer.editor.getBody()).each((index, element) => {
            entityTextContent += element.textContent;
        });
        return entityTextContent;
    }
    /**
     * Sets the URI property and corresponding attribute
     * @param {String} entityId
     * @param {String} uri
     */
    setURIForEntity(entityId, uri) {
        const entity = this.getEntity(entityId);
        entity.setURI(uri);
        const uriMapping = this.writer.schemaManager.mapper.getAttributeForProperty(entity.getType(), 'uri');
        if (uriMapping)
            entity.setAttribute(uriMapping, uri);
    }
    /**
     * Sets the lemma property and corresponding attribute
     * @param {String} entityId
     * @param {String} lemma
     */
    setLemmaForEntity(entityId, lemma) {
        const entity = this.getEntity(entityId);
        entity.setLemma(lemma);
        const lemmaMapping = this.writer.schemaManager.mapper.getAttributeForProperty(entity.getType(), 'lemma');
        if (lemmaMapping)
            entity.setAttribute(lemmaMapping, lemma);
    }
    /**
     * Sets the certainty property and corresponding attribute
     * @param {String} entityId
     * @param {String} certainty
     */
    setCertaintyForEntity(entityId, certainty) {
        const entity = this.getEntity(entityId);
        entity.setCertainty(certainty);
        const certaintyMapping = this.writer.schemaManager.mapper.getAttributeForProperty(entity.getType(), 'certainty');
        if (certaintyMapping)
            entity.setAttribute(certaintyMapping, certainty);
    }
    /**
     * Sets the precision property and corresponding attribute
     * @param {String} entityId
     * @param {String} certainty
     */
    setPrecisionForEntity(entityId, precision) {
        const entity = this.getEntity(entityId);
        entity.setPrecision(precision);
        const precisionyMapping = this.writer.schemaManager.mapper.getAttributeForProperty(entity.getType(), 'precision');
        if (precisionyMapping)
            entity.setAttribute(precisionyMapping, precision);
    }
    removeHighlights() {
        const prevHighlight = $('.entityHighlight', this.writer.editor?.getBody());
        if (prevHighlight.length !== 0) {
            prevHighlight.each((index, element) => {
                const $p = $(element);
                if ($p.hasClass('noteWrapper')) {
                    $p.removeClass('entityHighlight');
                    return;
                }
                const parent = $p.parent()[0];
                $p.contents().length !== 0 ? $p.contents().unwrap() : $p.remove();
                parent.normalize();
            });
        }
        if (this.currentEntity !== null) {
            this.writer.event('entityUnfocused').publish(this.currentEntity);
        }
    }
    /**
     * Highlights an entity or removes the highlight from a previously highlighted entity.
     * @fires Writer#entityUnfocused
     * @fires Writer#entityFocused
     * @param {String} [id] The entity ID.
     * @param [bm] TinyMce bookmark
     * @param {Boolean} [doScroll] True to scroll to the entity
     */
    highlightEntity(id, bm, doScroll) {
        // clear previous highlight
        this.removeHighlights();
        this.currentEntity = null;
        if (!id)
            return;
        this.currentEntity = id;
        const entityTags = $(`[name="${id}"]`, this.writer.editor.getBody());
        if (entityTags.length <= 0)
            return;
        const entity = this.getEntity(id);
        const type = entity.getType();
        // clear selection
        let rng = this.writer.editor.dom.createRng();
        this.writer.editor.selection.setRng(rng);
        if (entity.isNote()) {
            entityTags.parent('.noteWrapper').removeClass('hide').addClass('entityHighlight');
        }
        else {
            entityTags.wrap(`<span class="entityHighlight ${type}"/>`);
            entityTags.parents('.noteWrapper').removeClass('hide'); // if the entity is inside a note, make sure that it's shown
        }
        if (bm) {
            // maintain the original caret position
            this.writer.editor.selection.moveToBookmark(bm);
        }
        else {
            // move inside entity
            rng = this.writer.editor.dom.createRng();
            rng.setStart(entityTags[0], 0);
            rng.collapse(true);
            this.writer.editor.selection.setRng(rng);
        }
        if (doScroll) {
            const val = entityTags.offset()?.top ?? 0;
            $(this.writer.editor.getDoc().documentElement).scrollTop(val);
        }
        this.writer.event('entityFocused').publish(id);
    }
    /**
     * Check to see if any of the entities overlap.
     * @returns {Boolean}
     */
    doEntitiesOverlap() {
        // remove highlights
        this.highlightEntity();
        let overlap = false;
        this.eachEntity((id, entity) => {
            const markers = this.writer.editor.dom.select(`[name="${id}"]`);
            if (markers.length > 1) {
                const start = markers[0];
                const end = markers[markers.length - 1];
                if (start.parentNode !== end.parentNode) {
                    overlap = true;
                    return false; // stop looping through entities
                }
            }
        });
        return overlap;
    }
    /**
     * Removes entities that overlap other entities.
     */
    removeOverlappingEntities() {
        this.highlightEntity();
        this.eachEntity((id, entity) => {
            const markers = this.writer.editor.dom.select(`[name="${id}"]`);
            if (markers.length > 1) {
                const start = markers[0];
                const end = markers[markers.length - 1];
                if (start.parentNode !== end.parentNode) {
                    this.writer.tagger.removeEntity(id);
                }
            }
        });
    }
    /**
     * Converts boundary entities (i.e. entities that overlapped) to tag entities, if possible.
     * TODO review
     */
    convertBoundaryEntitiesToTags() {
        this.eachEntity((id, entity) => {
            const markers = this.writer.editor.dom.select(`[name="${id}"]`);
            if (markers.length > 1) {
                let canConvert = true;
                const parent = markers[0].parentNode;
                for (let i = 0; i < markers.length; i++) {
                    if (markers[i].parentNode !== parent) {
                        canConvert = false;
                        break;
                    }
                }
                if (canConvert) {
                    const $tag = $(this.writer.editor.dom.create('span', {}, ''));
                    const atts = markers[0].attributes;
                    for (let i = 0; i < atts.length; i++) {
                        const att = atts[i];
                        $tag.attr(att.name, att.value);
                    }
                    $tag.addClass('end');
                    $tag.attr('id', $tag.attr('name') ?? '');
                    $tag.attr('_tag', entity.getTag() ?? '');
                    // TODO add entity.getAttributes() as well?
                    $(markers).wrapAll($tag);
                    $(markers).contents().unwrap();
                    // TODO normalize child text?
                }
            }
        });
    }
    /**
     * Removes all the entities.
     */
    reset() {
        this.currentEntity = null;
        this.entities = {};
    }
}
export default EntitiesManager;
//# sourceMappingURL=entitiesManager.js.map