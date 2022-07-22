import type { IContext } from 'overmind';
import * as document from './document';
import * as editor from './editor';
import * as lookups from './lookups';
import * as ui from './ui';
import * as user from './user';
import * as validator from './validator';
export declare const config: {
    state: import("overmind/lib/internalTypes").SubType<{
        document: {
            loaded: boolean;
            schemaId: string;
            schemaName: string;
            xml?: string;
            url?: string;
        };
        editor: {
            advancedSettings: boolean;
            allowOverlap: boolean;
            annotationMode: number;
            annotationModeLabel: string;
            annotationModes: {
                value: number;
                label: string;
                disabled?: boolean;
            }[];
            baseUrl?: string;
            currentFontSize: number;
            editorMode: string;
            editorModeLabel: string;
            editorModes: {
                key: number;
                value: string;
                label: string;
            }[];
            fontSizeOptions: number[];
            isAnnotator: boolean;
            isEditorDirty: boolean;
            isReadonly: boolean;
            mode: number;
            nssiToken?: string | (() => Promise<string>);
            schemas: import("../types").Schema[];
            proxyLoaderXmlEndpoint?: string;
            proxyLoaderCssEndpoint?: string;
            settings?: any;
            showEntities: boolean;
            showTags: boolean;
            lookups: import("../types").ILookups;
        };
        lookups: {
            isUriValid: boolean;
            manualInput: string;
            query: string;
            results?: Map<import("../types").Authority, import("../components/entityLookups/types").IResult[]>;
            selected?: import("../components/entityLookups/types").EntryLink;
            typeEntity: import("../js/schema/types").EntityTypes;
            typeLookup: import("../components/entityLookups/types").NamedEntityType;
        };
        ui: {
            contextMenu: import("../types").ContextMenuState;
            darkMode: boolean;
            editSourceProps: import("../components/editSource").IEditSourceDialogProps;
            entityLookupDialogProps: import("../components/entityLookups/types").EntityLookupDialogProps;
            language: import("../types").Language;
            popupProps: import("../components/popup").PopupProps;
            settingsDialogOpen: boolean;
            themeAppearance: "light" | "auto" | "dark";
            title: string;
        };
        user: import("../types").User;
        validator: {
            hasSchema: boolean;
            hasWorkerValidator: boolean;
        };
    }, object>;
    effects: import("overmind/lib/internalTypes").SubType<{
        document: unknown;
        editor: typeof editor.effects;
        lookups: typeof lookups.effects;
        ui: unknown;
        user: unknown;
        validator: unknown;
    }, object>;
    actions: import("overmind/lib/internalTypes").SubType<{
        document: typeof document.actions;
        editor: typeof editor.actions;
        lookups: typeof lookups.actions;
        ui: typeof ui.actions;
        user: typeof user.actions;
        validator: typeof validator.actions;
    }, object>;
};
export declare type Context = IContext<typeof config>;
export declare const useAppState: import("overmind-react").StateHook<Context>;
export declare const useActions: () => {
    editor: {
        readonly writerInitSettings: (payload?: import("../types").ILeafWriterOptionsSettings) => void;
        readonly initiateLookupServices: () => Promise<void>;
        readonly initiateLookupSources: (payload?: import("../components/entityLookups/types").ILookupsConfig) => Promise<void>;
        readonly applyInitialSettings: () => void;
        readonly setNssiToken: (payload?: string | (() => Promise<string>)) => void;
        readonly getNssiToken: () => Promise<string>;
        readonly setFontSize: (payload?: number) => void;
        readonly toggleShowTags: (payload?: boolean) => void;
        readonly showEntities: (payload?: boolean) => void;
        readonly toggleAdvancedSettings: (payload?: boolean) => void;
        readonly setReadonly: (payload?: boolean) => void;
        readonly setEditorMode: (payload?: string) => {
            key: number;
            value: string;
            label: string;
        };
        readonly getEditorModeByKey: (payload?: number) => {
            key: number;
            value: string;
            label: string;
        };
        readonly getEditorModeByValue: (payload?: string) => {
            key: number;
            value: string;
            label: string;
        };
        readonly setAnnotationrMode: (payload?: number) => {
            value: number;
            label: string;
            disabled?: boolean;
        };
        readonly addShema: (payload?: import("../types").Schema) => import("../types").Schema;
        readonly resetDialogWarnings: () => void;
        readonly resetPreferences: () => void;
        readonly getSettings: (payload?: string) => {
            isAdvanced: boolean;
            fontSize: number;
            showEntities: boolean;
            showTags: boolean;
            mode: number;
            editorMode: string;
            annotationMode: number;
            allowOverlap: boolean;
            schemaId: string;
        };
        readonly setIsAnnotator: (payload?: boolean) => void;
        readonly toggleLookupAuthority: (payload?: import("../types").Authority) => void;
        readonly toggleLookupEntity: (payload?: {
            authorityId: import("../types").Authority;
            entityName: import("../components/entityLookups/types").NamedEntityType;
        }) => void;
        readonly reorderLookupPriority: (payload?: import("../components/entityLookups/types").IAuthorityService[]) => void;
        readonly retrieveLookupAutoritiesConfig: () => any;
        readonly getContent: () => Promise<string>;
        readonly setIsEditorDirty: (payload?: boolean) => void;
        readonly clear: () => void;
    };
    ui: {
        readonly onInitializeOvermind: () => void;
        readonly setThemeAppearance: (payload?: import("../types").PaletteMode) => void;
        readonly setDarkMode: (payload?: boolean) => void;
        readonly closeContextMenu: () => void;
        readonly showContextMenu: (payload?: import("../types").ContextMenuState) => void;
        readonly updateTitle: (payload?: string) => void;
        readonly resetPreferences: () => void;
        readonly openPopup: (payload?: Omit<import("../components/popup").PopupProps, "open">) => void;
        readonly closePopup: (payload?: string) => void;
        readonly openEditSourceDialog: (payload?: string) => void;
        readonly closeEditSourceDialog: () => void;
        readonly processEditSource: (payload?: string) => void;
        readonly openEntityLookupsDialog: (payload?: Omit<import("../components/entityLookups/types").EntityLookupDialogProps, "open">) => void;
        readonly closeEntityLookupsDialog: (payload?: import("../components/entityLookups/types").EntityLink | Pick<import("../components/entityLookups/types").EntityLink, "type" | "query">) => void;
        readonly switchLanguage: (payload?: string) => string;
        readonly openSettingsDialog: () => void;
        readonly closeSettingsDialog: () => void;
    };
    document: {
        readonly setInitialStateSchema: (payload?: string) => void;
        readonly setLoaded: (payload?: boolean) => void;
        readonly setSchema: (payload?: string) => import("../types").Schema;
        readonly setDocumentUrl: (payload?: string) => void;
        readonly updateContent: (payload?: string) => void;
        readonly clear: () => void;
        readonly loadDocumentXML: (payload?: string) => void;
    };
    user: {
        readonly setUser: (payload?: import("../types").User) => void;
    };
    lookups: {
        readonly initiate: (payload?: {
            entry?: import("../js/entities/Entity").default;
            type: import("../js/dialogs/types").DialogLookupType;
        }) => void;
        readonly setType: (payload?: import("../js/schema/types").EntityTypes) => void;
        readonly search: (payload?: string) => Promise<any[] | Map<import("../types").Authority, import("../components/entityLookups/types").IResult[]>>;
        readonly processSelected: () => import("../components/entityLookups/types").EntityLink;
        readonly setSelected: (payload?: import("../components/entityLookups/types").EntryLink) => void;
        readonly setQuery: (payload?: string) => void;
        readonly setManualInput: (payload?: string) => void;
        readonly reset: () => void;
    };
    validator: {
        readonly loadValidator: () => Promise<void>;
        readonly initialize: () => Promise<void>;
        readonly validate: () => Promise<void>;
        readonly getAt: (payload?: {
            action: "TagAt" | "ElementsForTagAt" | "AttributesForTagAt" | "AttributeAt" | "ValuesForTagAttributeAt";
            attributeName?: string;
            index?: number;
            parentXpath?: string;
            tagName?: string;
            xpath?: string;
        }) => Promise<import("@cwrc/leafwriter-validator").ElementDetail | import("@cwrc/leafwriter-validator").ElementDetail[]>;
        readonly getTagAt: (payload?: {
            tagName: string;
            parentXpath: string;
            index?: number;
        }) => Promise<import("@cwrc/leafwriter-validator").ElementDetail>;
        readonly getElementsForTagAt: (payload?: {
            xpath: string;
            index?: number;
        }) => Promise<import("@cwrc/leafwriter-validator").ElementDetail[]>;
        readonly getAttributesForTagAt: (payload?: {
            xpath: string;
            index?: number;
        }) => Promise<import("@cwrc/leafwriter-validator").ElementDetail[]>;
        readonly getTagAttributeAt: (payload?: {
            attributeName: string;
            parentXpath: string;
        }) => Promise<import("@cwrc/leafwriter-validator").ElementDetail>;
        readonly getValuesForTagAttributeAt: (payload?: {
            xpath: string;
        }) => Promise<import("@cwrc/leafwriter-validator").ElementDetail[]>;
        readonly getValidTagsAt: (payload?: import("@cwrc/leafwriter-validator").GetValidTagsAtParameters) => Promise<import("@cwrc/leafwriter-validator").ElementDetail[]>;
        readonly clear: () => void;
    };
};
export declare const useEffects: () => import("overmind/lib/internalTypes").SubType<{
    document: unknown;
    editor: typeof editor.effects;
    lookups: typeof lookups.effects;
    ui: unknown;
    user: unknown;
    validator: unknown;
}, object>;
export declare const useReaction: () => import("overmind").IReaction<Context>;
//# sourceMappingURL=index.d.ts.map