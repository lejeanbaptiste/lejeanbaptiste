import 'jquery-ui';
import Writer from '../../../Writer';
interface ImageViewerProps {
    attribute?: string;
    parentId: string;
    tag?: string;
    writer: Writer;
}
declare class ImageViewer {
    readonly writer: Writer;
    readonly id: string;
    readonly tagName: string;
    readonly attrName: string;
    readonly $parent: JQuery<HTMLElement>;
    osd: any | null;
    $pageBreaks: any;
    currentIndex: number;
    ignoreScroll: boolean;
    constructor({ attribute, parentId, tag, writer }: ImageViewerProps);
    private cssHack;
    private osdReset;
    private processDocument;
    private setMessage;
    private hideViewer;
    private handleScroll;
    private loadPage;
    private resizeImage;
    reset(): void;
    destroy(): void;
}
export default ImageViewer;
//# sourceMappingURL=index.d.ts.map