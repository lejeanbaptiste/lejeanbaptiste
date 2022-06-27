import '../../lib/jquery/jquery.popup';
import Writer from '../Writer';
import type { ILWDialog, ILWDialogConfigParams } from './types';
declare class Popup implements ILWDialog {
    readonly writer: Writer;
    readonly noteMouseoverSelector = ".noteWrapper.hide";
    readonly noteClickSelector = ".noteWrapper";
    readonly $popupEl: JQuery<HTMLElement>;
    $currentTag: JQuery | null;
    popupCloseId: any;
    linkSelector: string;
    attributeSelector: string;
    constructor({ writer, parentEl }: ILWDialogConfigParams);
    private setupListeners;
    private setCurrentTag;
    private doMouseOver;
    private doMouseOut;
    private doClick;
    /**
     * Show the content in the popup element
     * @param {String|Element} content The content to show
     * @param {String} type The entity type
     */
    private doPopup;
    private attributeMouseover;
    private linkMouseover;
    private showLink;
    private noteMouseover;
    private noteClick;
    private hidePopup;
    private removeListeners;
    show(): void;
    destroy(): void;
}
export default Popup;
//# sourceMappingURL=popup.d.ts.map