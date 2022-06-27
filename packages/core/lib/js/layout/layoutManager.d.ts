import 'jquery-ui/ui/widgets/tabs';
import 'layout-jquery3';
import Writer from '../Writer';
interface InitConfigProps {
    editorId: string;
    container: JQuery<HTMLElement>;
    modules?: any;
    name?: string;
}
declare type LayoutLocation = 'east' | 'west' | 'north' | 'south';
interface IModuleConfig {
    id: string;
    config?: any;
    title?: string;
}
declare class LayoutManager {
    readonly writer: Writer;
    $containerid: string;
    $container: JQuery<HTMLElement> | null;
    $loadingMask: JQuery<HTMLElement> | null;
    $headerButtons: JQuery<HTMLElement> | null;
    $outerLayout: JQuery<HTMLElement> | null;
    $innerLayout: JQuery<HTMLElement> | null;
    name: string;
    editorId: string;
    readonly PANEL_MIN_WIDTH = 320;
    modulesLayout: Map<LayoutLocation, IModuleConfig | IModuleConfig[]>;
    modules: any[];
    constructor(writer: Writer, config?: InitConfigProps);
    init(config: InitConfigProps): void;
    showModule(moduleId: string): void;
    hideModule(moduleId: string): void;
    showRegion(region: LayoutLocation, tabIndex?: number): void;
    hideRegion(region: LayoutLocation): void;
    showToolbar(): void;
    hideToolbar(): void;
    toggleFullScreen(): void;
    isFullScreen(): boolean;
    resizeAll(): void;
    getContainer(): JQuery<HTMLElement>;
    getHeaderButtonsParent(): JQuery<HTMLElement>;
    destroy(): void;
    private isModuleAllowed;
    private addPanel;
    private initModule;
}
export default LayoutManager;
//# sourceMappingURL=layoutManager.d.ts.map