import 'jquery-ui/ui/widgets/dialog';
import Writer from '../Writer';
declare class Header {
    readonly writer: Writer;
    readonly $headerLink: JQuery<HTMLElement>;
    readonly $headerDialog: JQuery<HTMLElement>;
    constructor(writer: Writer, parentEl: JQuery<HTMLElement>);
    private doOpen;
    show(): void;
    destroy(): void;
}
export default Header;
//# sourceMappingURL=header.d.ts.map