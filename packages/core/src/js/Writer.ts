import $ from 'jquery';
import tinymce from 'tinymce';
import { ConfigLegacy, LeafWriterEditor, LWDocument, onSaveRequestResults } from '../@types';
import '../css/build.less';
import '../lib/jquery/jquery_3.5_workaround';
import Converter from './conversion/converter';
import DialogManager from './dialogManager';
import AnnotationsManager from './entities/annotationsManager';
import EntitiesManager from './entities/entitiesManager';
import EventManager from './eventManager';
import LayoutManager from './layout/layoutManager';
import EntitiesList from './layout/panels/entitiesList';
import Selection from './layout/panels/selection';
import Validation from './layout/panels/validation';
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
//  * @param {String} [config.cwrcRootUrl]
//  * @param {Boolean} [config.readonly]
//  * @param {Boolean} [config.annotator]
//  * @param {String} [config.mode]
//  * @param {Boolean} [config.allowOverlap]
//  * @param {String} [config.buttons1]
//  * @param {String} [config.buttons2]
//  * @param {String} [config.buttons3]
//  */

// interface IWriter {
//   event: IEvent;
// }

class Writer extends EventManager {
  overmindState?: any;
  overmindActions?: any;

  readonly initialConfig: ConfigLegacy;
  readonly containerId: string;
  readonly cwrcRootUrl: string; // the url which points to the root of the leafwriter location

  // possible editor modes
  readonly XMLRDF = 0; // XML + RDF
  readonly XML = 1; // XML only
  readonly RDF = 2; // RDF only (not currently used)
  readonly JSON = 3; // annotation type

  editor?: LeafWriterEditor; // reference to the tinyMCE instance we're creating, set in setup
  triples: [] = []; // triples store

  currentDocId: string | null = null;
  isInitialized: boolean = false; // is the editor initialized
  isDocLoaded: boolean = false; // has a doc been loaded
  isReadOnly: boolean = false; // is the editor in readonly mode
  isAnnotator: boolean = false; // is the editor in annotate (entities) only mode

  mode: number = this.XMLRDF; // editor mode
  annotationMode: number = this.JSON; //format to produce annotations in (XML or JSON)
  allowOverlap: boolean = false; // can entities overlap?

  // entityLookupDialogs: EntityLookupDialogsLegacy

  onLoadRequest?: () => void;
  onSaveRequest?: (document: LWDocument, saveAs?: boolean) => Promise<onSaveRequestResults>;

  _settings: {
    filterTags: {
      useDocumentTags: boolean;
      useStructuralOrder: boolean;
    };
  };

  utilities: Utilities;
  layoutManager: LayoutManager;
  schemaManager: SchemaManager;
  entitiesManager: EntitiesManager;
  dialogManager: DialogManager;
  tagger: Tagger;
  converter: Converter;
  annotationsManager: AnnotationsManager;

  readonly editorId: string;
  readonly layoutContainerId: string;

  entitiesList?: EntitiesList;
  selection?: Selection;
  validation?: Validation;

  constructor(config: ConfigLegacy) {
    super();

    this.initialConfig = config;

    //html container
    if (!config.container) throw Error('no container supplied for LeafWriter!');
    this.containerId = config.container;

    //root URL
    if (!config.cwrcRootUrl || config.cwrcRootUrl === '') {
      const { protocol, host, pathname } = window.location;
      let rootUrl = `${protocol}//${host}/${pathname.split('/')[1]}/`;
      if (rootUrl.endsWith('//')) rootUrl = rootUrl.slice(0, -1);
      this.cwrcRootUrl = rootUrl;

      console.info('using default leafRootUrl', rootUrl);
    } else {
      this.cwrcRootUrl = config.cwrcRootUrl;
    }

    if (config.readonly) this.isReadOnly = config.readonly;
    if (config.annotator) this.isAnnotator = config.annotator;

    // editor mode
    if (config.mode === 'xml') this.mode = this.XML;
    if (config.mode === 'rdf') this.mode = this.RDF;

    // can entities overlap?
    if (config.allowOverlap) this.allowOverlap = config.allowOverlap;
    if (this.allowOverlap && this.mode === this.XML) {
      this.allowOverlap = false;
      console.warn(
        "Mode set to XML and overlap allowed. Disabling overlap since XML doesn't allow it."
      );
    }

    if (config.onLoadRequest) this.onLoadRequest = config.onLoadRequest;
    if (config.onSaveRequest) this.onSaveRequest = config.onSaveRequest;

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
      } catch (e) {
        console.log(e);
      }
    });

    window.addEventListener('keydown', (event: KeyboardEvent) =>
      this.handleKeyStrokeCapture(event)
    );
    this.event('writerKeydown').subscribe(this.handleKeyStrokeCapture);

    this.event('processingDocument').subscribe(() => {
      this.triples = [];
    });

    this.event('documentLoaded').subscribe((success: boolean) => {
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

    this.schemaManager = new SchemaManager(this, config.schema);
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

  handleKeyStrokeCapture(event: KeyboardEvent) {
    if (!event.metaKey) return;

    let action: 'save' | 'saveas' | 'load' | '' = '';

    if (event.shiftKey && event.code === 'KeyS') action = 'saveas';
    if (event.code === 'KeyS') action = 'save';
    if (event.code === 'KeyO') action = 'load';

    if (action === '') return;

    event.preventDefault();
    event.stopPropagation();

    if (action === 'saveas') return this.overmindActions.editor.saveDocument(true);
    if (action === 'save') return this.overmindActions.editor.saveDocument();
    if (action === 'load') return this.showLoadDialog();
  }

  /**
   * Gets a unique ID for use within Leaf-Writer.
   * @param {String} prefix The prefix to attach to the ID.
   * @returns {String} id
   */
  getUniqueId(prefix: string) {
    return tinymce.DOM.uniqueId(prefix);
  }

  /**
   * Loads a document into the editor
   * @fires Writer#loadingDocument
   * @param {String} docUrl An URL pointing to an XML document
   */
  loadDocumentURL(docUrl: string) {
    this.converter.loadDocumentURL(docUrl);
  }

  /**
   * Load a document into the editor
   * @fires Writer#loadingDocument
   * @param {Document|String} docXml An XML document or a string representation of such.
   */
  loadDocumentXML(docXml: string) {
    this.converter.loadDocumentXML(docXml);
  }

  showLoadDialog() {
    if (this.onLoadRequest) this.onLoadRequest();
  }

  async save(saveAs?: boolean) {
    const docString = await this.getDocumentString();

    this.overmindActions.document.updateContent(docString);

    const { resource, url, content } = this.overmindState.document;
    const document = { file: { ...resource }, url, xml: resource.content };

    if (!this.onSaveRequest) {
      console.warn('No save function');
      return;
    }

    const response = await this.onSaveRequest(document, saveAs);
    if (response.success && response.hash) {
      this.overmindActions.document.updateResourceHash(response.hash);
    }
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

  validate(callback?: Function) {
    if (callback) {
      const doCallback = (isValid: boolean) => {
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
  getDocumentXML(callback: Function) {
    this.converter.getDocument(false, callback);
  }

  /**
   * Get the document contents as a string
   * @param {Function} callback Callback is called with a string representation of the document
   */
  async getDocumentString(callback?: Function) {
    return await this.converter.getDocument(true, callback);
  }

  /**
   * Set the current document for the editor
   * @param {Document|String} document Can be one of: URL, XML document, XML string
   */
  setDocument(document: Document | string) {
    this.converter.setDocument(document);
  }

  /**
   * Get the raw HTML representation of the document
   * @returns {String}
   */
  getDocRawContent(): string {
    const editor = this.editor;
    if (!editor) return '';

    return editor.getContent({ format: 'raw' });
  }

  /**
   * Is the editor read only?
   * @returns {Boolean}
   */
  isEditorReadOnly(): boolean {
    return this.editor?.getBody().getAttribute('contenteditable') === 'false';
  }

  /**
   * Destroy the Leaf-Writer
   */
  destroy() {
    // console.info('destroying', this.editor?.id);

    const editor = this.editor;
    if (!editor) return;

    try {
      // clear the editor first (large docs can cause the browser to freeze)
      $(editor.getBody()).empty();
    } catch (e) {
      console.log(e);
    }

    window.removeEventListener('keydown', (event: KeyboardEvent) =>
      this.handleKeyStrokeCapture(event)
    );
    window.removeEventListener('beforeunload', this.handleUnload);

    editor.remove();
    editor.destroy();

    this.utilities.destroy();
    this.dialogManager.destroy();
    this.layoutManager.destroy();

    this.overmindActions.document.clear();
    this.overmindActions.editor.clear();
  }

  handleUnload(event: BeforeUnloadEvent) {
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
