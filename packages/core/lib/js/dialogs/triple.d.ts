import 'jquery-ui/ui/widgets/button';
import '../../lib/jquery/jquery.watermark.min';
import Writer from '../Writer';
interface IComponent {
    external: boolean;
    name?: string;
    text: string;
    uri?: string;
}
export interface ITriple {
    subject: IComponent;
    predicate: IComponent;
    object: IComponent;
}
declare class Triple {
    readonly writer: Writer;
    readonly $triple: JQuery<HTMLElement>;
    readonly $subject: JQuery<HTMLElement>;
    readonly $predicate: JQuery<HTMLElement>;
    readonly $object: JQuery<HTMLElement>;
    constructor(writer: Writer, parentEl: JQuery<HTMLElement>);
    private loadPredicates;
    private getPredicateName;
    private getComponents;
    private updateRelationString;
    private buildEntity;
    show(): void;
    destroy(): void;
}
export default Triple;
//# sourceMappingURL=triple.d.ts.map