import { Context } from '../';
import Writer from '../../js/Writer';
declare global {
    interface Window {
        writer: Writer;
    }
}
export declare const setInitialStateSchema: ({ state }: Context, id: string) => void;
export declare const setLoaded: ({ state }: Context, value: boolean) => void;
export declare const setSchema: ({ state }: Context, id: string) => import("../../types").Schema;
export declare const setDocumentUrl: ({ state }: Context, url: string) => void;
export declare const updateContent: ({ state }: Context, content: string) => void;
export declare const clear: ({ state }: Context) => void;
export declare const loadDocumentXML: ({ actions }: Context, content: string) => void;
//# sourceMappingURL=actions.d.ts.map