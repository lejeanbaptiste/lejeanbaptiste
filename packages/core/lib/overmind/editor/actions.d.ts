import { Context } from '../';
import type { Authority, ILookupsConfig, ILookupService, LookupsEntityType } from '../../components/entityLookups/types';
import { ILeafWriterOptionsSettings, Schema } from '../../types';
export declare const writerInitSettings: ({ state: { editor }, actions }: Context, settings: ILeafWriterOptionsSettings) => void;
export declare const initiateLookupServices: ({ state, actions, effects }: Context, serviceType?: 'custom' | 'nssi') => Promise<void>;
export declare const initiateLookupSources: ({ state: { editor }, actions, effects }: Context, config?: ILookupsConfig) => Promise<void>;
export declare const applyInitialSettings: ({ state, actions }: Context) => void;
export declare const setNssiToken: ({ state }: Context, value: string | (() => Promise<string | undefined>)) => void;
export declare const getNssiToken: ({ state }: Context) => Promise<string>;
export declare const setFontSize: ({ state }: Context, value: number) => void;
export declare const toggleShowTags: ({ state }: Context, value?: boolean) => void;
export declare const showEntities: ({ state }: Context, value: boolean) => void;
export declare const toggleAdvancedSettings: ({ state }: Context, value: boolean) => void;
export declare const setReadonly: ({ state }: Context, value: boolean) => void;
export declare const setEditorMode: ({ state }: Context, editorMode: string) => {
    key: number;
    value: string;
    label: string;
};
export declare const getEditorModeByKey: ({ state }: Context, key: number) => {
    key: number;
    value: string;
    label: string;
};
export declare const getEditorModeByValue: ({ state }: Context, value: string) => {
    key: number;
    value: string;
    label: string;
};
export declare const setAnnotationrMode: ({ state }: Context, value: number) => {
    value: number;
    label: string;
    disabled?: boolean;
};
export declare const addShema: ({ state }: Context, newSchema: Schema) => Schema;
export declare const resetDialogWarnings: ({ state }: Context) => void;
export declare const resetPreferences: ({ state, actions, effects }: Context) => void;
export declare const getSettings: ({ state }: Context, config?: string) => {
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
export declare const setIsAnnotator: ({ state }: Context, value: boolean) => void;
export declare const toggleLookupAuthority: ({ state: { editor }, effects }: Context, id: Authority) => void;
export declare const toggleLookupEntity: ({ state: { editor }, effects }: Context, { authorityId, entityName }: {
    authorityId: Authority;
    entityName: LookupsEntityType;
}) => void;
export declare const reorderLookupPriority: ({ state: { editor }, effects }: Context, authorities: ILookupService[]) => void;
export declare const retrieveLookupAutoritiesConfig: ({ effects }: Context) => any;
export declare const getContent: ({ state }: Context) => Promise<any>;
export declare const setIsEditorDirty: ({ state }: Context, value: boolean) => void;
export declare const clear: ({ state }: Context) => void;
//# sourceMappingURL=actions.d.ts.map