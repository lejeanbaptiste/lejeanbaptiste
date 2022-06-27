const getTitleFromContent = (content) => {
    content = content.trim().replace(/\s+/g, ' ');
    if (content.length <= 34)
        return content;
    const title = content.substring(0, 34) + '&#8230;';
    return title;
};
const getSourceNameFromUrl = (url) => {
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
    annotationRange = {};
    /** Values that can be directly mapped onto the entity's tag.  */
    attributes = {};
    /** The text content of the entity. */
    content;
    /** Values that can't be directly mapped onto the entity's tag. */
    customValues = {};
    /** When the entity was created. A date in ISO string format */
    dateCreated;
    /** Timestamp when the entity was modified the last time. A date in ISO string format */
    dateModified;
    /** The internal ID of the entity. */
    id;
    /** Is the entity named, i.e. does it have a URI */
    _isNamedEntity = false;
    /** Is the entity a note */
    _isNote = false;
    /** XML content, used by note-type entities. */
    noteContent;
    /** The parent tag of the entity.*/
    tag;
    /** A label for use when displaying information about the entity. Typically will be a concatenated version of the content. */
    title;
    /** The type of the entity, e.g. person, place, date. */
    type;
    // NAMED ENTITY PROPERTIES
    /** The creator of the entity annotation. */
    creator;
    /** The certainty of the entity annotation. */
    certainty;
    /** The lemma for this entity (usually from a lookup). */
    lemma;
    /** The precision of the entity annotation. Only used on a few entity types */
    precision;
    /** The source associated with this entity URI (usually from a lookup). */
    source;
    /** The URI associated with this entity (usually from a lookup). */
    uri;
    // UTILITIES PROPERTIES
    /** If the entity got updated over the session. */
    _didUpdate = false;
    /** Store original data loaded from XML. */
    _originalData;
    constructor(config) {
        // SET VALUES FROM CONFIG
        this.id = config.id;
        this.type = config.type;
        this.tag = config.tag;
        // DATE CREATED
        if (config.dateCreated) {
            // try setting the date
            const date = new Date(config.dateCreated);
            this.dateCreated = isNaN(date.valueOf())
                ? new Date().toISOString() // invalid date so use now
                : date.toISOString();
        }
        else if (config?.originalData?.['dcterms:created']) {
            // try setting the date
            const date = new Date(config.originalData['dcterms:created']);
            this.dateCreated = isNaN(date.valueOf())
                ? new Date().toISOString() // invalid date so use now
                : date.toISOString();
        }
        else {
            this.dateCreated = new Date().toISOString();
        }
        // DATE MODIFIED
        if (config?.dateModified) {
            // try setting the date
            const date = new Date(config.dateModified);
            this.dateCreated = isNaN(date.valueOf())
                ? this.dateCreated // invalid date so use now
                : date.toISOString();
        }
        else if (config?.originalData?.['dcterms:modified']) {
            // try setting the date
            const date = new Date(config.originalData['dcterms:modified']);
            this.dateCreated = isNaN(date.valueOf())
                ? this.dateCreated // invalid date so use now
                : date.toISOString();
        }
        else {
            this.dateModified = this.dateCreated;
        }
        if (config.content)
            this.setContent(config.content);
        if (config.attributes)
            this.attributes = config.attributes;
        if (config.customValues)
            this.customValues = config.customValues;
        if (config.noteContent) {
            this.noteContent = config.noteContent;
            this._isNote = true;
        }
        if (config.isNote)
            this._isNote = config.isNote;
        if (config.range)
            this.annotationRange = config.range;
        if (config.uri) {
            this.uri = config.uri;
            this._isNamedEntity = true;
        }
        if (config.lemma)
            this.lemma = config.lemma;
        if (config.certainty)
            this.certainty = config.certainty;
        if (config.precision)
            this.precision = config.precision;
        if (config.isNamedEntity)
            this._isNamedEntity = config.isNamedEntity;
        if (config?.originalData?.['dcterms:creator']) {
            this.creator = config.originalData['dcterms:creator'];
        }
        if (config.didUpdate)
            this._didUpdate = config.didUpdate;
        if (config.originalData)
            this._originalData = config.originalData;
    }
    getId() {
        return this.id;
    }
    setId(id) {
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
    setTag(tag) {
        this.tag = tag;
    }
    getContent() {
        return this.content;
    }
    setContent(content) {
        this.content = content;
        this.title = getTitleFromContent(this.content);
    }
    getTitle() {
        return this.lemma ? this.lemma : this.title;
    }
    getAttribute(key) {
        return this.attributes[key];
    }
    setAttribute(name, value) {
        this.attributes[name] = value;
    }
    getAttributes() {
        return this.attributes;
    }
    setAttributes(attObj) {
        this.attributes = {};
        for (const key in attObj) {
            this.attributes[key] = attObj[key];
        }
    }
    removeAttribute(name) {
        delete this.attributes[name];
    }
    getCustomValue(key) {
        return this.customValues?.[key];
    }
    setCustomValue(name, value) {
        this.customValues[name] = value;
    }
    getCustomValues() {
        return this.customValues;
    }
    setCustomValues(propOjb) {
        this.customValues = propOjb;
    }
    removeCustomValue(name) {
        delete this.customValues[name];
    }
    setProperty(property, value) {
        if (this.hasOwnProperty(property)) {
            //@ts-ignore
            this[property] = value;
        }
    }
    getNoteContent() {
        return this.noteContent;
    }
    setNoteContent(content) {
        this.noteContent = content;
    }
    getDateCreated() {
        return this.dateCreated;
    }
    getDateModified() {
        return this.dateModified;
    }
    setDateModified(date) {
        this.dateModified = date ? date : new Date().toISOString();
    }
    getURI() {
        return this.uri;
    }
    //? Don't call directly. Use setURIForEntity through the EntitiesManager.
    setURI(uri) {
        this.uri = uri;
        this.setSource(uri);
    }
    getSource() {
        return this.uri;
    }
    //? Don't call directly. setUri will update the source
    setSource(uri) {
        const source = getSourceNameFromUrl(uri);
        this.source = source;
    }
    getLemma() {
        return this.lemma; //return this.lemma ? this.lemma : this.title;
    }
    //? Don't call directly. Use setLemmaForEntity through the EntitiesManager.
    setLemma(lemma) {
        this.lemma = lemma;
    }
    getCertainty() {
        return this.certainty;
    }
    //? Don't call directly. Use setCertaintyForEntity through the EntitiesManager.
    setCertainty(certainty) {
        this.certainty = certainty;
    }
    getPrecision() {
        return this.precision;
    }
    //? Don't call directly. Use setPrecisionForEntity through the EntitiesManager.
    setPrecision(precision) {
        this.precision = precision;
    }
    getRange() {
        return this.annotationRange;
    }
    setRange(rangeObj) {
        this.annotationRange = rangeObj;
    }
    getCreator() {
        return this.creator;
    }
    setCreator(creator) {
        this.creator = creator;
    }
    get didUpdate() {
        return this._didUpdate;
    }
    setDidUpdate(value) {
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
//# sourceMappingURL=Entity.js.map