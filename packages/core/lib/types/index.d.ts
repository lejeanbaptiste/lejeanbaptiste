import type { Bookmark, Editor } from 'tinymce/tinymce';
import type { ILookupsConfig } from '../components/entityLookups/types';
import Writer from '../js/Writer';
export type { Authority, ILookupsConfig } from '../components/entityLookups/types';
export declare var webpackEnv: {
    LEAFWRITER_VERSION?: string;
    NODE_ENV: string;
    WORKER_ENV: string;
};
export interface ILeafWriterOptions {
    document: LWDocument;
    preferences?: {
        fontSize?: number;
        themeMode?: string;
        workspace?: {
            leftSide: string[];
            rightSide: string[];
        };
    };
    settings?: ILeafWriterOptionsSettings;
    user?: User;
}
export interface LWDocument {
    url?: string;
    xml: string;
}
export interface ILeafWriterOptionsSettings {
    container?: string;
    baseUrl?: string;
    nerveUrl?: string;
    proxyLoaders: {
        cssEndpoint: string;
        xmlEndpoint: string;
    };
    credentials?: {
        nssiToken?: string | (() => Promise<string | undefined>);
    };
    colorScheme?: string;
    language?: string;
    lookups?: ILookupsConfig;
    schemas?: Schema[];
    schemasId?: SupportedSchemasId[];
    modules?: Object;
    services?: any;
    readonly?: boolean;
    annotator?: boolean;
    mode?: string;
    allowOverlap?: boolean;
    buttons1?: string[];
    buttons2?: string[];
    buttons3?: string[];
}
export declare type SupportedSchemasId = 'cwrcTeiLite' | 'orlando' | 'event' | 'cwrcEntry' | 'epidoc' | 'teiAll' | 'teiDrama' | 'teiCorpus' | 'teiMs' | 'teiLite' | 'reed';
export declare type SupportedEntityLookups = 'dbpedia' | 'geonames' | 'getty' | 'lgpn' | 'viaf' | 'wikidata' | 'cwrc';
export declare const SupportedSchemas: Map<string, Schema>;
export interface User {
    avatar_url?: string;
    email?: string;
    name: string;
    uri: string;
}
export declare type Schema = {
    id: string;
    name: string;
    mapId?: string;
    schemaMappingsId: string;
    xml?: string | string[];
    css?: string | string[];
    xmlUrl: string | string[];
    cssUrl: string | string[];
};
export interface Language {
    code: string;
    name: string;
    shortName: string;
}
export declare const Languages: Map<string, Language>;
export declare type ErrorType = 'info' | 'warning' | 'error';
export interface IError {
    type?: ErrorType;
    message: string;
}
export declare enum EntityType {
    PERSON = "person",
    PLACE = "place",
    ORGANIZATION = "organization",
    ORG = "org",
    REFERENCING_STRING = "referencing_string",
    RS = "rs",
    TITLE = "title",
    CITATION = "citation",
    NOTE = "note",
    DATE = "date",
    CORRECTION = "correction",
    KEYWORD = "keyword",
    LINK = "link"
}
export declare type PaletteMode = 'light' | 'auto' | 'dark';
export interface ContextMenuState {
    show: boolean;
    position?: {
        posX: number;
        posY: number;
    };
    eventSource?: string;
    tagId?: string | string[];
    useSelection?: boolean;
    allowsTagAround?: boolean;
    element?: HTMLElement | null;
    hasContentSelection?: boolean;
    isEntity?: boolean;
    isHeader?: boolean;
    isRoot?: boolean;
    isMultiple?: boolean;
    rng?: Range;
    tagName?: string | null;
}
export interface LeafWriterEditor extends Editor {
    writer?: Writer;
    currentBookmark?: Bookmark;
    currentNode?: Node | undefined;
    copiedElement?: {
        selectionType?: any;
        element?: Element | undefined;
    };
    copiedEntity?: any;
    lastKeyPress?: string;
}
export declare type MappingID = 'cwrcEntry' | 'orlando' | 'tei' | 'teiLite';
//# sourceMappingURL=index.d.ts.map