import 'jquery-ui/ui/widgets/dialog';
import Writer from '../Writer';
declare class EditSource {
    readonly writer: Writer;
    readonly $edit: JQuery<HTMLElement>;
    constructor(writer: Writer, parentEl: JQuery<HTMLElement>);
    private doOpen;
    show(): void;
    destroy(): void;
}
export default EditSource;
//# sourceMappingURL=editSource.d.ts.map