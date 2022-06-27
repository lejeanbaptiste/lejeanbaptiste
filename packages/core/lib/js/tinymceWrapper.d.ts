import 'tinymce/icons/default';
import 'tinymce/plugins/paste';
import 'tinymce/themes/silver';
import { type TinyMCE } from 'tinymce/tinymce';
import './tinymce_plugins/prevent_delete';
import './tinymce_plugins/treepaste';
import Writer from './Writer';
declare global {
    interface Window {
        tinymce: TinyMCE;
    }
}
interface TinymceWrapperConfig {
    writer: Writer;
    editorId: string;
    layoutContainerId: string;
    buttons1: string[];
    buttons2?: string[];
    buttons3?: string[];
}
export declare const tinymceWrapperInit: ({ writer, editorId, layoutContainerId, buttons1, buttons2, buttons3, }: TinymceWrapperConfig) => void;
export {};
//# sourceMappingURL=tinymceWrapper.d.ts.map