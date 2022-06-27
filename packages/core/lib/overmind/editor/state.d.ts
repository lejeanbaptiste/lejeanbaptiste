import type { ILookups } from '../../components/entityLookups/types';
import type { Schema } from '../../types';
declare type State = {
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
    nssiToken?: string | (() => Promise<string | undefined>);
    schemas: Schema[];
    proxyLoaderXmlEndpoint?: string;
    proxyLoaderCssEndpoint?: string;
    settings?: any;
    showEntities: boolean;
    showTags: boolean;
    lookups: ILookups;
};
export declare const state: State;
export {};
//# sourceMappingURL=state.d.ts.map