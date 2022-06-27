import 'jquery-ui/ui/widgets/checkboxradio';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import Writer from '../../../Writer';
interface ConfigProps {
    parentId: string;
    writer: Writer;
}
declare class Selection {
    readonly id: string;
    readonly selectionTrimLength = 500000;
    readonly writer: Writer;
    readonly $includeRdf: JQuery<HTMLElement>;
    readonly $prismContainer: JQuery<HTMLElement>;
    readonly $selectionContents: JQuery<HTMLElement>;
    editor: monaco.editor.IStandaloneCodeEditor | undefined;
    enabled: boolean;
    lastUpdate: number;
    showingFullDoc: boolean;
    constructor({ parentId, writer }: ConfigProps);
    private updateView;
    private setupEditor;
    private clearView;
    enable(forceUpdate: boolean): void;
    disable(): void;
    showSelection(): void;
    destroy(): void;
}
export default Selection;
//# sourceMappingURL=index.d.ts.map