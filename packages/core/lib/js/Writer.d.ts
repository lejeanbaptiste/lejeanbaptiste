import '../css/build.less';
import '../lib/jquery/jquery_3.5_workaround';
import type { ILeafWriterOptionsSettings, LeafWriterEditor } from '../types';
import Converter from './conversion/converter';
import DialogManager from './dialogManager';
import { ITriple } from './dialogs/triple';
import AnnotationsManager from './entities/annotationsManager';
import EntitiesManager from './entities/entitiesManager';
import EventManager from './eventManager';
import LayoutManager from './layout/layoutManager';
import EntitiesList from './layout/panels/entitiesList';
import Selection from './layout/panels/selection';
import StructureTree from './layout/panels/structureTree';
import Validation from './layout/panels/validation';
import SchemaManager from './schema/schemaManager';
import Tagger from './tagger';
import Utilities from './utilities';
declare class Writer extends EventManager {
    overmindState?: any;
    overmindActions?: any;
    readonly initialConfig: ILeafWriterOptionsSettings;
    readonly containerId: string;
    readonly baseUrl: string;
    readonly XMLRDF = 0;
    readonly XML = 1;
    readonly RDF = 2;
    readonly JSON = 3;
    editor?: LeafWriterEditor;
    triples: ITriple[];
    currentDocId: string | null;
    isInitialized: boolean;
    isDocLoaded: boolean;
    isReadOnly: boolean;
    isAnnotator: boolean;
    mode: number;
    annotationMode: number;
    allowOverlap: boolean;
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
    tree?: StructureTree;
    constructor(config: ILeafWriterOptionsSettings);
    /**
     * Gets a unique ID for use within Leaf-Writer.
     * @param {String} prefix The prefix to attach to the ID.
     * @returns {String} id
     */
    getUniqueId(prefix: string): string;
    /**
     * Loads a document into the editor
     * @fires Writer#loadingDocument
     * @param {String} docUrl An URL pointing to an XML document
     */
    loadDocumentURL(docUrl: string): void;
    /**
     * Load a document into the editor
     * @fires Writer#loadingDocument
     * @param {Document|String} docXml An XML document or a string representation of such.
     */
    loadDocumentXML(docXml: string): void;
    getContent(): Promise<any>;
    getDocumentURI(): any;
    getUserInfo: () => {
        id: any;
        name: any;
        nick: any;
    };
    validate(callback?: Function): void;
    /**
     * Get the document contents as XML
     * @param {Function} callback Callback is called with an XML representation of the document
     */
    getDocumentXML(callback: Function): void;
    /**
     * Get the document contents as a string
     * @param {Function} callback Callback is called with a string representation of the document
     */
    getDocumentString(callback?: Function): Promise<any>;
    /**
     * Set the current document for the editor
     * @param {Document|String} document Can be one of: URL, XML document, XML string
     */
    setDocument(document: Document | string): void;
    /**
     * Get the raw HTML representation of the document
     * @returns {String}
     */
    getDocRawContent(): string;
    /**
     * Is the editor read only?
     * @returns {Boolean}
     */
    isEditorReadOnly(): boolean;
    /**
     * Destroy the Leaf-Writer
     */
    destroy(): void;
    handleUnload(event: BeforeUnloadEvent): string;
}
export default Writer;
//# sourceMappingURL=Writer.d.ts.map