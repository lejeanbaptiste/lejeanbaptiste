import type { Schema } from '../../types';
import Writer from '../Writer';
import Mapper from './mapper';
/**
 * @class SchemaManager
 * @param {Writer} writer
 * @param {Object} config
 * @param {Array} config.schemas
 */
declare class SchemaManager {
    readonly writer: Writer;
    private readonly BLOCK_TAG;
    private readonly INLINE_TAG;
    readonly mapper: Mapper;
    readonly getChildrenForTag: (tag: string) => any[];
    readonly getAttributesForTag: (tag: string) => any[];
    readonly getAttributesForPath: (path: string) => any[];
    readonly getParentsForTag: (tag: string) => {
        name: string;
        level: number;
    }[];
    readonly proxyXmlEndpoint: string | null;
    readonly proxyCssEndpoint: string | null;
    schemas: Schema[];
    /**
     * The ID of the current validation schema, according to config.schemas
     */
    schemaId: string | null;
    /**
     * A cached copy of the loaded schema
     * @member {Document}
     */
    schemaXML: any;
    rng: string | null;
    /**
     * A JSON version of the schema
     * @member {Object}
     */
    schemaJSON: any | null;
    /**
     * Stores a list of all the elements of the current schema
     * @member {Object}
     * @property {Array} elements The list of elements
     */
    schema: {
        elements: string[];
    };
    private root;
    private header;
    private idName;
    private css;
    private currentDocumentRng;
    private currentDocumentCss;
    constructor(writer: Writer, schemas: Schema[]);
    getBlockTag(): string;
    getInlineTag(): string;
    /**
     * Get the URL for the XML for the current schema.
     * @returns {String}
     */
    getRng(): string;
    /**
     * Gets the schema object for the current schema.
     * @returns {Object}
     */
    getCurrentSchema(): Schema;
    /**
     * Returns the schemaId associated with a specific root
     * @param {String} root The root name
     * @returns {String|undefined} The schemaId
     */
    getSchemaIdFromRoot(root: string): string;
    /**
     * Returns the schemaId associated with the specified schema url.
     * @param {String} url The schema url
     * @returns {String|undefined} The schemaId
     */
    getSchemaIdFromUrl(url: string): string;
    /**
     * Get the root tag name for the current schema.
     * @returns {String}
     */
    getRoot(): string;
    /**
     * Get the header tag name for the current schema.
     * @returns {String}
     */
    getHeader(): string;
    /**
     * Get the name of the ID attribute for the current schema.
     * @returns {String}
     */
    getIdName(): string;
    /**
     * Get the URL for the CSS for the current schema.
     * @returns {String}
     */
    getCss(): string;
    /**
     * Is the current schema custom? I.e. is it lacking entity mappings?
     * @returns {Boolean}
     */
    isSchemaCustom(): boolean;
    getCurrentDocumentSchemaUrl(): string;
    setCurrentDocumentSchemaUrl(url: string): void;
    getCurrentDocumentCss(): string;
    setCurrentDocumentCss(url: string): void;
    /**
     * Checks to see if the tag can contain text, as specified in the schema
     * @param {string} tag The tag to check
     * @returns boolean
     */
    canTagContainText(tag: string): boolean;
    isTagBlockLevel(tagName: string): boolean;
    isTagEntity(tagName: string): boolean;
    getTagForEditor(tagName: string): "div" | "span";
    getDocumentationForTag(tag: string): string;
    getFullNameForTag(tag: string): string;
    /**
     * Gets the children for a tag but only includes those that are required.
     * @param {String} tag The tag name.
     * @returns {Object}
     */
    getRequiredChildrenForTag(tag: string): any[];
    /**
     * Checks to see if the tag can have attributes, as specified in the schema
     * @param {string} tag The tag to check
     * @returns boolean
     */
    canTagHaveAttributes(tag: string): boolean;
    /**
     * Verifies that the child has a valid parent.
     * @param {String} childName The child tag name
     * @param {String} parentName The parent tag name
     * @returns {Boolean}
     */
    isTagValidChildOfParent(childName: string, parentName: string): boolean;
    /**
     * Verifies that the attribute is valid for the tag
     * @param {String} attributeName The attribute name
     * @param {String} tagName The tag name
     * @returns {Boolean}
     */
    isAttributeValidForTag(attributeName: string, tagName: string): boolean;
    /**
     * Checks whether the node removal would invalidate the document.
     * @param {Element} contextNode The context node for the removal
     * @param {Boolean} removeContext Is the context node being removed
     * @param {Boolean} removeContents Are the node contents being removed?
     * @returns {Boolean}
     */
    wouldDeleteInvalidate({ contextNode, removeContext, removeContents, }: {
        contextNode: Element;
        removeContext?: Boolean;
        removeContents?: Boolean;
    }): boolean;
    /**
     * Add a schema to the list.
     * @fires Writer#schemaAdded
     * @param {Object} config The config object
     * @param {String} config.name A name for the schema
     * @param {Array} config.rng The xml url(s) for the schema
     * @param {Array} config.css The css url(s) for the schema
     * @returns {String} id The id for the schema
     *
     */
    addSchema(config: Omit<Schema, 'id'>): string;
    /**
     * Gets the url(s) associated with the schema
     * @param {String} schemaId The ID of the schema
     * @returns {Array|null} Collection of urls for the schema
     */
    getUrlForSchema(schemaId: string): string[];
    /**
     * Gets the name of the root element for the schema
     * @param {String} schemaId The ID of the schema
     * @returns {String} The (first) root name
     */
    getRootForSchema(schemaId: string): Promise<any>;
    /**
     * Load a Schema XML.
     * @param {Array} urls Collection of url sources
     * @returns {Document} The XML
     */
    private loadSchemaFile;
    /**
     * Load an include schema.
     * @param {String} schemaEntry The Schchema object, including the Schema URL
     * @param {String} include The schema to include
     */
    private loadIncludes;
    /**
     * Process a schema:
     * - Add CSS for displaying tags in the editor
     * - Hide the header tag
     * - Set references to the elements and the JSON version of the schema
     */
    private processSchema;
    /**
     * Load a new schema.
     * @fires Writer#loadingSchema
     * @fires Writer#schemaLoaded
     * @param {String} schemaId The ID of the schema to load (from the config)
     * @param {Boolean} loadCss Whether to load the associated CSS
     * @param {Function} [callback] Callback for when the load is complete
     */
    loadSchema(schemaId: string, loadCss: boolean, callback?: Function): Promise<any>;
    /**
     * Load a Schema CSS.
     * @param {Array} urls Collection of url sources
     * @returns {String} The CSS
     */
    private loadCSSFile;
    /**
     * Load the CSS and convert it to the internal format
     * @param {Array} schemaId Collection of url sources
     */
    loadSchemaCSS(schemaId: string): Promise<any>;
}
export default SchemaManager;
//# sourceMappingURL=schemaManager.d.ts.map