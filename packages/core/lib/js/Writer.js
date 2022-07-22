import $ from 'jquery';
import tinymce from 'tinymce';
import '../css/build.less';
import '../lib/jquery/jquery_3.5_workaround';
import { log } from './../utilities';
import Converter from './conversion/converter';
import DialogManager from './dialogManager';
import AnnotationsManager from './entities/annotationsManager';
import EntitiesManager from './entities/entitiesManager';
import EventManager from './eventManager';
import LayoutManager from './layout/layoutManager';
import SchemaManager from './schema/schemaManager';
import Tagger from './tagger';
import { tinymceWrapperInit } from './tinymceWrapper';
import Utilities from './utilities';
// /**
//  * @class LeafWriter
//  * @param {Object} config
//  * @param {String} config.container
//  * @param {Object} config.storageDialogs
//  * @param {Object} config.entityLookupDialogs
//  * @param {Object} config.schemas
//  * @param {Object} config.modules
//  * @param {String} [config.baseUrl]
//  * @param {Boolean} [config.readonly]
//  * @param {Boolean} [config.annotator]
//  * @param {String} [config.mode]
//  * @param {Boolean} [config.allowOverlap]
//  * @param {String} [config.buttons1]
//  * @param {String} [config.buttons2]
//  * @param {String} [config.buttons3]
//  */
class Writer extends EventManager {
    overmindState;
    overmindActions;
    initialConfig;
    containerId;
    baseUrl; // the url which points to the root of the leafwriter location
    // possible editor modes
    XMLRDF = 0; // XML + RDF
    XML = 1; // XML only
    RDF = 2; // RDF only (not currently used)
    JSON = 3; // annotation type
    editor; // reference to the tinyMCE instance we're creating, set in setup
    triples = []; // triples store
    currentDocId = null;
    isInitialized = false; // is the editor initialized
    isDocLoaded = false; // has a doc been loaded
    isReadOnly = false; // is the editor in readonly mode
    isAnnotator = false; // is the editor in annotate (entities) only mode
    mode = this.XMLRDF; // editor mode
    annotationMode = this.JSON; //format to produce annotations in (XML or JSON)
    allowOverlap = false; // can entities overlap?
    // entityLookupDialogs: EntityLookupDialogsLegacy
    _settings;
    utilities;
    layoutManager;
    schemaManager;
    entitiesManager;
    dialogManager;
    tagger;
    converter;
    annotationsManager;
    editorId;
    layoutContainerId;
    entitiesList;
    selection;
    validation;
    tree;
    constructor(config) {
        super();
        this.initialConfig = config;
        //html container
        if (!config.container)
            throw Error('no container supplied for LeafWriter!');
        this.containerId = config.container;
        //root URL
        if (!config.baseUrl || config.baseUrl === '') {
            const { protocol, host, pathname } = window.location;
            let baseUrl = `${protocol}//${host}/${pathname.split('/')[1]}/`;
            if (baseUrl.endsWith('//'))
                baseUrl = baseUrl.slice(0, -1);
            this.baseUrl = baseUrl;
            log.info('using default leafRootUrl', baseUrl);
        }
        else {
            this.baseUrl = config.baseUrl;
        }
        if (config.readonly)
            this.isReadOnly = config.readonly;
        if (config.annotator)
            this.isAnnotator = config.annotator;
        // editor mode
        if (config.mode === 'xml')
            this.mode = this.XML;
        if (config.mode === 'rdf')
            this.mode = this.RDF;
        // can entities overlap?
        if (config.allowOverlap)
            this.allowOverlap = config.allowOverlap;
        if (this.allowOverlap && this.mode === this.XML) {
            this.allowOverlap = false;
            log.warn("Mode set to XML and overlap allowed. Disabling overlap since XML doesn't allow it.");
        }
        //tag filter
        this._settings = {
            filterTags: {
                useDocumentTags: true,
                useStructuralOrder: true,
            },
        };
        //----
        window.addEventListener('beforeunload', this.handleUnload);
        $(window).on('unload', () => {
            try {
                // clear the editor first (large docs can cause the browser to freeze)
                this.utilities.getRootTag().remove();
            }
            catch (e) {
                log.log(e);
            }
        });
        this.event('processingDocument').subscribe(() => {
            this.triples = [];
        });
        this.event('documentLoaded').subscribe((success) => {
            this.isDocLoaded = success ? true : false;
        });
        this.event('tinymceInitialized').subscribe(async () => {
            // fade out loading mask and do final resizing after tinymce has loaded
            //@ts-ignore
            this.layoutManager.$outerLayout.options.onresizeall_end = () => {
                //@ts-ignore
                this.layoutManager.$outerLayout.options.onresizeall_end = null;
                //@ts-ignore
                this.layoutManager.$loadingMask.fadeOut(350);
            };
            setTimeout(() => {
                this.layoutManager.resizeAll();
                setTimeout(() => {
                    this.isInitialized = true;
                    this.event('writerInitialized').publish(this);
                }, 350);
            }, 1000);
        });
        this.utilities = new Utilities(this);
        this.editorId = this.getUniqueId('editor_');
        $(`#${this.containerId}`).empty();
        this.layoutManager = new LayoutManager(this);
        this.layoutManager.init({
            editorId: this.editorId,
            modules: config.modules,
            container: $(`#${this.containerId}`),
        });
        this.schemaManager = new SchemaManager(this, config.schemas);
        this.entitiesManager = new EntitiesManager(this);
        this.dialogManager = new DialogManager(this); // needs to load before SettingsDialog
        this.tagger = new Tagger(this);
        this.converter = new Converter(this);
        this.annotationsManager = new AnnotationsManager(this);
        this.layoutContainerId = this.layoutManager.getContainer()?.attr('id') ?? '';
        tinymceWrapperInit({
            writer: this,
            editorId: this.editorId,
            layoutContainerId: this.layoutContainerId,
            buttons1: config.buttons1 ?? [],
            buttons2: config.buttons2,
            buttons3: config.buttons3,
        });
    }
    /**
     * Gets a unique ID for use within Leaf-Writer.
     * @param {String} prefix The prefix to attach to the ID.
     * @returns {String} id
     */
    getUniqueId(prefix) {
        return tinymce.DOM.uniqueId(prefix);
    }
    /**
     * Loads a document into the editor
     * @fires Writer#loadingDocument
     * @param {String} docUrl An URL pointing to an XML document
     */
    loadDocumentURL(docUrl) {
        this.converter.loadDocumentURL(docUrl);
    }
    /**
     * Load a document into the editor
     * @fires Writer#loadingDocument
     * @param {Document|String} docXml An XML document or a string representation of such.
     */
    loadDocumentXML(docXml) {
        this.converter.loadDocumentXML(docXml);
    }
    async getContent() {
        const docString = await this.getDocumentString();
        this.overmindActions.document.updateContent(docString);
        return docString;
    }
    getDocumentURI() {
        return this.overmindState.document.url;
    }
    getUserInfo = () => {
        const { url, name, username } = this.overmindState.user;
        return { id: url, name, nick: username };
    };
    //Function to override
    // showSaveAsDialog() {}
    // saveAndExit() {}
    validate(callback) {
        if (callback) {
            const doCallback = (isValid) => {
                callback.call(this, isValid);
                this.event('documentValidated').unsubscribe(doCallback);
            };
            this.event('documentValidated').subscribe(doCallback);
        }
        this.event('validationRequested').publish();
    }
    /**
     * Get the document contents as XML
     * @param {Function} callback Callback is called with an XML representation of the document
     */
    getDocumentXML(callback) {
        this.converter.getDocument(false, callback);
    }
    /**
     * Get the document contents as a string
     * @param {Function} callback Callback is called with a string representation of the document
     */
    async getDocumentString(callback) {
        return await this.converter.getDocument(true, callback);
    }
    /**
     * Set the current document for the editor
     * @param {Document|String} document Can be one of: URL, XML document, XML string
     */
    setDocument(document) {
        this.converter.setDocument(document);
    }
    /**
     * Get the raw HTML representation of the document
     * @returns {String}
     */
    getDocRawContent() {
        const editor = this.editor;
        if (!editor)
            return '';
        return editor.getContent({ format: 'raw' });
    }
    /**
     * Is the editor read only?
     * @returns {Boolean}
     */
    isEditorReadOnly() {
        return this.editor?.getBody().getAttribute('contenteditable') === 'false';
    }
    /**
     * Destroy the Leaf-Writer
     */
    destroy() {
        // log.info('destroying', this.editor?.id);
        const editor = this.editor;
        if (!editor)
            return;
        try {
            // clear the editor first (large docs can cause the browser to freeze)
            $(editor.getBody()).empty();
        }
        catch (e) {
            log.info(e);
        }
        window.removeEventListener('beforeunload', this.handleUnload);
        // editor.remove();
        // editor.destroy();
        this.utilities.destroy();
        this.dialogManager.destroy();
        this.layoutManager.destroy();
        this.overmindActions.document.clear();
        this.overmindActions.editor.clear();
        this.overmindActions.validator.clear();
    }
    handleUnload(event) {
        if ((!this.isReadOnly || this.isAnnotator) && window.location.hostname !== 'localhost') {
            if (tinymce.get(this.editorId).isDirty()) {
                const msg = 'You have unsaved changes.';
                (event || window.event).returnValue = msg;
                return msg;
            }
        }
    }
}
export default Writer;
//# sourceMappingURL=Writer.js.map