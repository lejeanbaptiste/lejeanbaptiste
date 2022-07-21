import '@fontsource/lato/100.css';
import '@fontsource/lato/300.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import '@fortawesome/fontawesome-free/css/all.css';
import { PaletteMode } from '@mui/material';
import { Subject } from 'rxjs';
import type { Authority, NamedEntityType } from './components/entityLookups/types';
import type { ILeafWriterOptions, LWDocument } from './types';
import './utilities/log';
export * as Types from './types';
export declare class Leafwriter {
    private readonly domElement;
    private _isDirty;
    private _onLoad;
    private options?;
    constructor(domElement: HTMLElement, options?: ILeafWriterOptions);
    private render;
    get isDirty(): Subject<boolean>;
    get onLoad(): Subject<{
        schemaName: string;
    }>;
    getContent(): Promise<string>;
    setContent(document: LWDocument): Promise<void>;
    getAllowOverlap(): boolean;
    getAnnotationMode(): number;
    getAnnotationModes(): {
        value: number;
        label: string;
        disabled?: boolean;
    }[];
    setAnnotationrMode(value: number): {
        value: number;
        label: string;
        disabled?: boolean;
    };
    getEditorMode(): string;
    getEditorModes(): {
        key: number;
        value: string;
        label: string;
    }[];
    setEditorMode(value: string): {
        key: number;
        value: string;
        label: string;
    };
    isAnnotator(): boolean;
    setIsAnnotator(value: boolean): void;
    isReadonly(): boolean;
    setIsReadonly(value: boolean): void;
    getSchemas(): import("./types").Schema[];
    setDocumentSchema(schemaId: string): import("./types").Schema;
    setDarkMode(value: boolean): void;
    setThemeAppearance(value: PaletteMode): void;
    switchLanguage(value: string): string;
    getPossibleFontSizes(): number[];
    getFontSize(value: number): number;
    setFontSize(value: number): number;
    getShowTags(): void;
    setShowTags(value: boolean): void;
    getShowEntities(): void;
    setShowEntities(value: boolean): void;
    getIsEditorDirty(): void;
    setIsEditorDirty(value: boolean): void;
    resetSettings(): void;
    getLookups(): void;
    setLookup({}: {
        name: Authority;
        enabled?: boolean;
        prioity?: number;
        entity?: {
            name: NamedEntityType;
            enabled?: string;
        };
        config?: {
            [x: string]: any;
            username?: string;
        };
    }): void;
    validate(): Promise<void>;
    showSettingsDialog(): Promise<void>;
    dispose(): void;
}
export default Leafwriter;
//# sourceMappingURL=index.d.ts.map