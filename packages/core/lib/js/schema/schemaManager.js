import axios from 'axios';
import CSS from 'css';
import $ from 'jquery';
import { log } from '../../utilities';
import Mapper from './mapper';
import * as schemaNavigator from './schemaNavigator';
/**
 * @class SchemaManager
 * @param {Writer} writer
 * @param {Object} config
 * @param {Array} config.schemas
 */
class SchemaManager {
    writer;
    BLOCK_TAG = 'div';
    INLINE_TAG = 'span';
    mapper;
    getChildrenForTag;
    // readonly getChildrenForPath: (path: string) => any[];
    getAttributesForTag;
    getAttributesForPath;
    getParentsForTag;
    // readonly getParentsForPath: (path: string) => any[];
    proxyXmlEndpoint = null;
    proxyCssEndpoint = null;
    schemas = [];
    /**
     * The ID of the current validation schema, according to config.schemas
     */
    schemaId = null;
    /**
     * A cached copy of the loaded schema
     * @member {Document}
     */
    schemaXML = null;
    rng = null;
    /**
     * A JSON version of the schema
     * @member {Object}
     */
    schemaJSON = null;
    /**
     * Stores a list of all the elements of the current schema
     * @member {Object}
     * @property {Array} elements The list of elements
     */
    schema = { elements: [] };
    root = null;
    header = '';
    idName = null;
    css = null;
    currentDocumentRng = null;
    currentDocumentCss = null;
    constructor(writer, schemas) {
        this.writer = writer;
        this.mapper = new Mapper(writer);
        //@ts-ignore
        // this.navigator = new SchemaNavigator();
        this.getChildrenForTag = (tag) => schemaNavigator.getChildrenForTag(tag);
        // this.getChildrenForPath = (tag) => this.navigator.getChildrenForPath(tag);
        this.getAttributesForTag = (tag) => schemaNavigator.getAttributesForTag(tag);
        this.getAttributesForPath = (tag) => schemaNavigator.getAttributesForPath(tag);
        this.getParentsForTag = (tag) => schemaNavigator.getParentsForTag(tag);
        // this.getParentsForPath = (tag) => this.navigator.getParentsForPath(tag);
        /**
         * An array of schema objects. Each object should have the following properties:
         * @member {Array} of {Objects}
         * @property {String} id A id for the schema
         * @property {String} name A name/label for the schema
         * @property {Array} rng Collection of URLs where the schema is located
         * @property {string} css Collection of URLs where the schema's CSS is located
         *
         */
        this.schemas = schemas ?? [];
        this.writer.event('schemaChanged').subscribe(async (schemaId) => {
            // this event is only fired by the settings dialog (by the user), so update the current document urls
            const res = await this.loadSchema(schemaId, true);
            if (res.success) {
                const rng = this.getRng();
                const css = this.getCss();
                if (rng)
                    this.setCurrentDocumentSchemaUrl(rng);
                if (css)
                    this.setCurrentDocumentCss(css);
            }
        });
    }
    getBlockTag() {
        return this.BLOCK_TAG;
    }
    getInlineTag() {
        return this.INLINE_TAG;
    }
    /**
     * Get the URL for the XML for the current schema.
     * @returns {String}
     */
    getRng() {
        return this.rng;
    }
    /**
     * Gets the schema object for the current schema.
     * @returns {Object}
     */
    getCurrentSchema() {
        return this.schemas.find((schema) => schema.id === this.schemaId);
    }
    /**
     * Returns the schemaId associated with a specific root
     * @param {String} root The root name
     * @returns {String|undefined} The schemaId
     */
    getSchemaIdFromRoot(root) {
        const schemaMapping = Array.from(this.mapper.mappings.entries()).find(([id, schemaMapping]) => {
            return schemaMapping.root.includes(root);
        });
        return schemaMapping?.[0];
    }
    /**
     * Returns the schemaId associated with the specified schema url.
     * @param {String} url The schema url
     * @returns {String|undefined} The schemaId
     */
    getSchemaIdFromUrl(url) {
        // remove the protocol in order to disregard http/https for improved chances of matching below
        const urlNoProtocol = url.split(/^.*?\/\//)[1];
        // search the known schemas, if the url matches it must be the same one
        const schema = this.schemas.find((schema) => {
            const match = schema.rng.find((url) => url.includes(urlNoProtocol));
            if (match)
                return schema;
        });
        return schema?.id;
    }
    /**
     * Get the root tag name for the current schema.
     * @returns {String}
     */
    getRoot() {
        return this.root;
    }
    /**
     * Get the header tag name for the current schema.
     * @returns {String}
     */
    getHeader() {
        return this.header;
    }
    /**
     * Get the name of the ID attribute for the current schema.
     * @returns {String}
     */
    getIdName() {
        return this.idName;
    }
    /**
     * Get the URL for the CSS for the current schema.
     * @returns {String}
     */
    getCss() {
        return this.css;
    }
    /**
     * Is the current schema custom? I.e. is it lacking entity mappings?
     * @returns {Boolean}
     */
    isSchemaCustom() {
        return this.getCurrentSchema()?.mapping === undefined;
    }
    getCurrentDocumentSchemaUrl() {
        return this.currentDocumentRng;
    }
    setCurrentDocumentSchemaUrl(url) {
        this.currentDocumentRng = url;
    }
    getCurrentDocumentCss() {
        return this.currentDocumentCss;
    }
    setCurrentDocumentCss(url) {
        this.currentDocumentCss = url;
    }
    /**
     * Checks to see if the tag can contain text, as specified in the schema
     * @param {string} tag The tag to check
     * @returns boolean
     */
    canTagContainText(tag) {
        if (tag === this.getRoot())
            return false;
        /**
         * @param currEl The element that's currently being processed
         * @param defHits A list of define tags that have already been processed
         * @param level The level of recursion
         * @param status Keep track of status while recursing
         */
        const checkForText = (currEl, defHits, level, status) => {
            if (status.canContainText)
                return false;
            // check for the text element
            const textHits = currEl.find('text');
            if (textHits.length > 0 && (level === 0 || textHits.parents('element').length === 0)) {
                // if we're processing a ref and the text is inside an element then it doesn't count
                status.canContainText = true;
                return false;
            }
            // now process the references
            //@ts-ignore
            currEl.find('ref').each((_index, el) => {
                const name = $(el).attr('name');
                if ($(el).parents('element').length > 0 && level > 0) {
                    return; // ignore other elements
                }
                //@ts-ignore
                if (!defHits[name]) {
                    //@ts-ignore
                    defHits[name] = true;
                    const def = $('define[name="' + name + '"]', this.schemaXML);
                    return checkForText(def, defHits, level + 1, status);
                }
            });
        };
        let useLocalStorage = false;
        if (useLocalStorage) {
            let localData = localStorage[`cwrc.${tag}.text`];
            if (localData)
                return localData === 'true';
        }
        const element = $(`element[name="${tag}"]`, this.schemaXML);
        const defHits = {};
        const level = 0;
        const status = { canContainText: false }; // needs to be an object so change is visible outside of checkForText
        checkForText(element, defHits, level, status);
        if (useLocalStorage)
            localStorage[`cwrc.${tag}.text`] = status.canContainText;
        return status.canContainText;
    }
    isTagBlockLevel(tagName) {
        if (tagName === this.getRoot())
            return true;
        return !!this.writer.editor?.schema.getBlockElements()[tagName];
    }
    isTagEntity(tagName) {
        const type = this.mapper.getEntityTypeForTag(tagName);
        return type !== null;
    }
    getTagForEditor(tagName) {
        return this.isTagBlockLevel(tagName) ? this.BLOCK_TAG : this.INLINE_TAG;
    }
    getDocumentationForTag(tag) {
        const element = $(`element[name="${tag}"]`, this.schemaXML);
        const doc = $('a\\:documentation, documentation', element).first().text();
        return doc;
    }
    getFullNameForTag(tag) {
        const element = $(`element[name="${tag}"]`, this.schemaXML);
        const doc = $('a\\:documentation, documentation', element).first().text();
        // if the tag name is an abbreviation, we expect the full name to be at the beginning of the doc, in parentheses
        const hit = /^\((.*?)\)/.exec(doc);
        if (hit !== null)
            return hit[1];
        return '';
    }
    /**
     * Gets the children for a tag but only includes those that are required.
     * @param {String} tag The tag name.
     * @returns {Object}
     */
    getRequiredChildrenForTag(tag) {
        const tags = this.getChildrenForTag(tag);
        for (let i = tags.length - 1; i > -1; i--) {
            if (tags[i].required !== true) {
                tags.splice(i, 1);
            }
        }
        return tags;
    }
    /**
     * Checks to see if the tag can have attributes, as specified in the schema
     * @param {string} tag The tag to check
     * @returns boolean
     */
    canTagHaveAttributes(tag) {
        const atts = this.getAttributesForTag(tag);
        return atts.length !== 0;
    }
    /**
     * Verifies that the child has a valid parent.
     * @param {String} childName The child tag name
     * @param {String} parentName The parent tag name
     * @returns {Boolean}
     */
    isTagValidChildOfParent(childName, parentName) {
        const parents = this.getParentsForTag(childName);
        for (const parent of parents) {
            if (parent.name === parentName)
                return true;
        }
        return false;
    }
    /**
     * Verifies that the attribute is valid for the tag
     * @param {String} attributeName The attribute name
     * @param {String} tagName The tag name
     * @returns {Boolean}
     */
    isAttributeValidForTag(attributeName, tagName) {
        const atts = this.getAttributesForTag(tagName);
        for (let i = 0; i < atts.length; i++) {
            if (atts[i].name === attributeName) {
                return true;
            }
        }
        return false;
    }
    /**
     * Checks whether the node removal would invalidate the document.
     * @param {Element} contextNode The context node for the removal
     * @param {Boolean} removeContext Is the context node being removed
     * @param {Boolean} removeContents Are the node contents being removed?
     * @returns {Boolean}
     */
    wouldDeleteInvalidate({ contextNode, removeContext = false, removeContents = false, }) {
        let parentEl = contextNode.parentElement;
        if (!parentEl)
            return false;
        let parentTag = parentEl.getAttribute('_tag');
        // handling for when we're inside entityHighlight
        while (parentTag === null) {
            parentEl = parentEl?.parentElement ?? null;
            if (parentEl === null) {
                log.warn('schemaManager.wouldDeleteInvalidate: outside of document!');
                return false;
            }
            parentTag = parentEl.getAttribute('_tag');
        }
        if (removeContext) {
            // check if parent requires context
            const contextTag = contextNode.getAttribute('_tag');
            const requiredChildren = this.getRequiredChildrenForTag(parentTag);
            const contextIsRequired = requiredChildren.find((rc) => {
                return rc.name === contextTag;
            });
            if (contextIsRequired) {
                // it's required, do siblings satisfy the requirement?
                let hasRequiredSibling = false;
                for (let i = 0; i < parentEl.children.length; i++) {
                    const child = contextNode.children[i];
                    if (child !== contextNode) {
                        const childTag = child.getAttribute('_tag');
                        if (childTag === contextTag) {
                            hasRequiredSibling = true;
                            break;
                        }
                    }
                }
                if (!hasRequiredSibling)
                    return true;
            }
            if (!removeContents) {
                // check if context children are valid for parent
                const validChildren = this.getChildrenForTag(parentTag);
                for (let i = 0; i < contextNode.children.length; i++) {
                    const child = contextNode.children[i];
                    const childTag = child.getAttribute('_tag');
                    const childIsValid = validChildren.find((vc) => {
                        return vc.name === childTag;
                    });
                    if (!childIsValid)
                        return true;
                }
                // check if context has text and if parent can contain text
                let hasTextNodes = false;
                contextNode.childNodes.forEach((cn) => {
                    if (!hasTextNodes && cn.nodeType === Node.TEXT_NODE && cn.textContent !== '\uFEFF') {
                        hasTextNodes = true;
                    }
                });
                if (hasTextNodes && this.canTagContainText(parentTag) === false) {
                    return true;
                }
            }
        }
        else {
            if (removeContents) {
                // check if context children are required
                const contextTag = contextNode.getAttribute('_tag');
                if (!contextTag)
                    return false;
                const requiredChildren = this.getRequiredChildrenForTag(contextTag);
                if (requiredChildren.length > 0)
                    return true;
            }
        }
        return false;
    }
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
    addSchema(config) {
        const { rng, css } = config;
        const id = this.writer.getUniqueId('schema');
        if (rng && typeof rng === 'string')
            config.rng = [rng];
        if (css && typeof css === 'string')
            config.css = [css];
        const newSchema = { id, ...config };
        this.schemas.push(newSchema);
        this.writer.event('schemaAdded').publish(newSchema.id);
        return newSchema.id;
    }
    /**
     * Gets the url(s) associated with the schema
     * @param {String} schemaId The ID of the schema
     * @returns {Array|null} Collection of urls for the schema
     */
    getUrlForSchema(schemaId) {
        const schemaEntry = this.schemas.find((schema) => schema.id === schemaId);
        if (schemaEntry)
            return schemaEntry.rng;
        return null;
    }
    /**
     * Gets the name of the root element for the schema
     * @param {String} schemaId The ID of the schema
     * @returns {String} The (first) root name
     */
    async getRootForSchema(schemaId) {
        //@ts-ignore
        if (this.mapper.mappings[schemaId] !== undefined) {
            //@ts-ignore
            const name = this.mapper.mappings[schemaId]?.root[0];
            if (name)
                return name;
        }
        const rng = this.getUrlForSchema(schemaId);
        if (!rng)
            throw `schemaManager.getRootForSchema: no url for ${schemaId}`;
        //load resource
        const schemaXML = await this.loadSchemaFile(rng);
        if (!schemaXML)
            throw `schemaManager.getRootForSchema: could not connect to ${schemaId}`;
        let rootEl = $('start element:first', schemaXML).attr('name');
        if (!rootEl) {
            const startName = $('start ref:first', schemaXML).attr('name');
            rootEl = $(`define[name="${startName}"] element`, schemaXML).attr('name');
        }
        return rootEl;
    }
    /**
     * Load a Schema XML.
     * @param {Array} urls Collection of url sources
     * @returns {Document} The XML
     */
    async loadSchemaFile(urls) {
        // prioritize the document schema
        if (this.currentDocumentRng && !urls.includes(this.currentDocumentRng)) {
            urls = [this.currentDocumentRng, ...urls];
        }
        let isAltRoute = false;
        let i = 0;
        for await (const url of urls) {
            i++;
            const response = await axios.get(url).catch((error) => {
                if (error.response) {
                    const message = `A network error occurred while trying to reach ${url}. This could be a CORS issue or a dropped internet connection. ${i < urls.length
                        ? 'LEAF-Writer will try to load the Schema using an alternative route.'
                        : 'LEAF-Writer could not load a schema for this document.'}`;
                    log.warn(message);
                }
                else if (error.request) {
                    log.warn(error.request);
                }
                else {
                    log.warn('Error', error.message);
                }
                // log.warn(error);
            });
            //if no response, try another url. This is our tactic to deal with CORS in some resoruces
            if (!response) {
                isAltRoute = true;
                continue;
            }
            if (isAltRoute)
                log.info(`Schema loaded from an alternative route: ${url}`);
            // Convert to XML
            const xml = this.writer.utilities.stringToXML(response.data);
            this.rng = url;
            return xml;
        }
        return;
    }
    /**
     * Load an include schema.
     * @param {String} schemaEntry The Schchema object, including the Schema URL
     * @param {String} include The schema to include
     */
    async loadIncludes(schemaEntry, include) {
        let schemaFile;
        const includeHref = include.attr('href');
        if (includeHref && includeHref.includes('/')) {
            schemaFile = includeHref.match(/(.*\/)(.*)/)?.[2]; // grab the filename
        }
        else {
            schemaFile = includeHref;
        }
        const schemaBase = schemaEntry.url.match(/(.*\/)(.*)/)[1];
        const url = schemaBase !== null ? schemaBase + schemaFile : `schema/${schemaFile}`;
        //load resource
        const includesXML = await this.loadSchemaFile([url]);
        if (!includesXML)
            return null;
        include.children().each((index, el) => {
            if (el.nodeName == 'start') {
                $('start', includesXML).replaceWith(el);
            }
            else if (el.nodeName == 'define') {
                const name = $(el).attr('name');
                let match = $(`define[name="${name}"]`, includesXML);
                if (match.length == 1) {
                    match.replaceWith(el);
                }
                else {
                    $('grammar', includesXML).append(el);
                }
            }
        });
        include.replaceWith($('grammar', includesXML).children());
        return;
    }
    /**
     * Process a schema:
     * - Add CSS for displaying tags in the editor
     * - Hide the header tag
     * - Set references to the elements and the JSON version of the schema
     */
    async processSchema() {
        // remove old schema elements
        $('#schemaTags', this.writer.editor?.dom.doc).remove();
        // create css to display schema tags
        $('head', this.writer.editor?.getDoc()).append('<style id="schemaTags" type="text/css" />');
        let schemaTags = '';
        const elements = [];
        $('element', this.schemaXML).each((index, el) => {
            const tag = $(el).attr('name');
            if (tag && !elements.includes(tag)) {
                elements.push(tag);
                schemaTags += `
          .showTags *[_tag=${tag}]:before {
            background-color: white;
            color: #aaa !important;
            padding-left: 2px;
            padding-right: 2px;
            padding-bottom: 2px;
            margin-right: 4px;
            border-radius: 4px;
            font-family: 'Lato';
            font-size: 13px !important;
            font-weight: normal !important;
            font-style: normal !important;
            font-variant: normal !important;
            box-shadow: 0 0 2px #aaaa;
            content: "<${tag}>";
          }
        `;
                schemaTags += `
          .showTags *[_tag=${tag}]:after {
            background-color: white;
            color: #aaa !important;
            padding-left: 2px;
            padding-right: 2px;
            padding-bottom: 2px;
            margin-left: 4px;
            border-radius: 4px;
            font-family: 'Lato';
            font-size: 13px !important;
            font-weight: normal !important;
            font-style: normal !important;
            font-variant: normal !important;
            box-shadow: 0 0 2px #aaaa;
            content: "</${tag}>";
          }
        `;
            }
        });
        elements.sort();
        // hide the header
        const tagName = this.getTagForEditor(this.header);
        schemaTags += `${tagName} [_tag=${this.header}] { display: none !important; }`;
        $('#schemaTags', this.writer.editor?.getDoc()).text(schemaTags);
        this.schema.elements = elements;
        schemaNavigator.setSchemaElements(this.schema.elements);
        // remove any child tags in the element/attribute documentation, as they are not handled properly during xmlToJSON
        $('a\\:documentation *', this.schemaXML).each((index, el) => {
            if (el.parentElement) {
                el.parentElement.innerHTML = this.writer.utilities.escapeHTMLString(el.parentElement.textContent);
            }
        });
        const schemaGrammar = $('grammar', this.schemaXML)[0];
        this.schemaJSON = this.writer.utilities.xmlToJSON(schemaGrammar);
        if (this.schemaJSON === null) {
            log.warn('schemaManager.loadSchema: schema XML could not be converted to JSON');
        }
        schemaNavigator.setSchemaJSON(this.schemaJSON);
        await this.writer.utilities.sendSchemaToworkerValidator();
    }
    /**
     * Load a new schema.
     * @fires Writer#loadingSchema
     * @fires Writer#schemaLoaded
     * @param {String} schemaId The ID of the schema to load (from the config)
     * @param {Boolean} loadCss Whether to load the associated CSS
     * @param {Function} [callback] Callback for when the load is complete
     */
    async loadSchema(schemaId, loadCss, callback) {
        const schemaEntry = this.schemas.find((schema) => schema.id === schemaId);
        if (!schemaEntry) {
            this.writer.dialogManager.show('message', {
                title: 'Error',
                msg: `Error loading schema. No entry found for: ${schemaId}`,
                type: 'error',
            });
            if (callback)
                return callback(false);
            return { success: false };
        }
        this.writer.event('loadingSchema').publish();
        this.schemaId = schemaId;
        this.writer.overmindActions.document.setInitialStateSchema(schemaId);
        const schemaMappingsId = schemaEntry.mapping;
        this.mapper.loadMappings(schemaMappingsId);
        //load resource
        const schemaXML = await this.loadSchemaFile(schemaEntry.rng);
        if (!schemaXML) {
            this.schemaId = null;
            this.writer.dialogManager.getDialog('loadingindicator')?.hide?.();
            this.writer.dialogManager.show('message', {
                title: 'Error',
                msg: `<p>Error loading schema from: ${schemaEntry.name}.</p>`,
                //   <p>Document editing will not work properly!</p>`,
                type: 'error',
            });
            if (callback)
                return callback(false);
            return { success: false };
        }
        this.schemaXML = schemaXML;
        // get root element
        let startEl = $('start element:first', this.schemaXML).attr('name');
        if (!startEl) {
            const startName = $('start ref:first', this.schemaXML).attr('name');
            startEl = $(`define[name="${startName}"] element`, this.schemaXML).attr('name');
        }
        this.root = startEl ?? null;
        this.header = this.mapper.getHeaderTag();
        this.idName = this.mapper.getIdAttributeName();
        // TODO is this necessary
        const additionalBlockElements = this.mapper.getBlockLevelElements();
        const blockElements = this.writer.editor?.schema.getBlockElements();
        if (blockElements) {
            for (let i = 0; i < additionalBlockElements.length; i++) {
                blockElements[additionalBlockElements[i]] = {};
            }
        }
        // handle includes
        const include = $('include:first', this.schemaXML); // TODO add handling for multiple includes
        if (include.length == 1) {
            await this.loadIncludes(schemaEntry, include); // TODO  it seems that includes goes nowhere.
        }
        //load CSS
        if (loadCss === true)
            this.loadSchemaCSS(schemaEntry.id);
        //Process schema
        this.processSchema();
        this.writer.event('schemaLoaded').publish();
        if (callback)
            return callback(true);
        return { success: true };
    }
    /**
     * Load a Schema CSS.
     * @param {Array} urls Collection of url sources
     * @returns {String} The CSS
     */
    async loadCSSFile(urls) {
        // prioritize the document CSS
        if (this.currentDocumentCss && !urls.includes(this.currentDocumentCss)) {
            urls = [this.currentDocumentCss, ...urls];
        }
        let isAltRoute = false;
        let i = 0;
        for await (const url of urls) {
            i++;
            const response = await axios.get(url).catch((error) => {
                if (error.response) {
                    const message = `A network error occurred while trying to reach ${url}. This could be a CORS issue or a dropped internet connection. ${i < urls.length
                        ? 'LEAF-Writer will try to load the CSS using an alternative route.'
                        : 'LEAF-Writer could not load a CSS for this document.'}`;
                    log.warn(message);
                }
                else if (error.request) {
                    log.warn(error.request);
                }
                else {
                    log.warn('Error', error.message);
                }
                // log.warn(error);
            });
            //if no response, try another url. This is our tactic to deal with CORS in some resoruces
            if (!response) {
                isAltRoute = true;
                continue;
            }
            // Convert to XML
            if (isAltRoute)
                log.info(`CSS loaded from an alternative route: ${url}`);
            this.css = url; // redefine schema manager css based on the available url
            return response.data;
        }
        return;
    }
    /**
     * Load the CSS and convert it to the internal format
     * @param {Array} schemaId Collection of url sources
     */
    async loadSchemaCSS(schemaId) {
        $('#schemaRules', this.writer.editor?.dom.doc).remove();
        $('#schemaRules', document).remove();
        const schemaEntry = this.schemas.find((schema) => schema.id === schemaId);
        if (!schemaEntry) {
            this.writer.dialogManager.show('message', {
                title: 'Error',
                msg: `Error loading schema. No entry found for: ${schemaId}`,
                type: 'error',
            });
            return;
        }
        //load resource
        const cssData = await this.loadCSSFile(schemaEntry.css);
        if (!cssData) {
            this.writer.dialogManager.show('message', {
                title: 'Error',
                msg: 'No CSS could be loaded to this schema.',
                type: 'error',
            });
            return null;
        }
        const cssObj = CSS.parse(cssData);
        const popupCssObj = {
            stylesheet: { rules: [] },
        };
        const rules = cssObj.stylesheet?.rules;
        if (rules) {
            for (let i = 0; i < rules.length; i++) {
                const rule = rules[i];
                const popupRule = Object.assign({}, rule);
                if (rule.type === 'rule') {
                    const convertedSelectors = [];
                    const convertedPopupSelectors = [];
                    //? rules doesn't have selectors
                    //@ts-ignore
                    for (let j = 0; j < rule.selectors.length; j++) {
                        //@ts-ignore
                        const selector = rule.selectors[j];
                        //@ts-ignore
                        const newSelector = selector.replace(/(^|,|\s)(#?\w+)/g, (str, p1, p2, offset, s) => {
                            return p1 + '*[_tag="' + p2 + '"]';
                        });
                        convertedPopupSelectors.push('.cwrc .popup ' + newSelector);
                        convertedSelectors.push(newSelector);
                    }
                    ///@ts-ignore
                    rule.selectors = convertedSelectors;
                    //@ts-ignore
                    popupRule.selectors = convertedPopupSelectors;
                    popupCssObj.stylesheet.rules.push(popupRule);
                }
            }
        }
        const cssString = CSS.stringify(cssObj);
        const popupCssString = CSS.stringify(popupCssObj);
        $('head', this.writer.editor?.dom.doc).append('<style id="schemaRules" type="text/css" />');
        $('#schemaRules', this.writer.editor?.dom.doc).text(cssString);
        // we need to also append to document in order for note popups to be styled
        $('head', document).append('<style id="schemaRules" type="text/css" />');
        $('#schemaRules', document).text(popupCssString);
    }
}
export default SchemaManager;
//# sourceMappingURL=schemaManager.js.map