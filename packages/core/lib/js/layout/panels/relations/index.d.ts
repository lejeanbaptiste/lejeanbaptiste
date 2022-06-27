import 'jquery-ui/ui/widgets/button';
import Writer from '../../../Writer';
interface RelationsProps {
    parentId: string;
    writer: Writer;
}
declare class Relations {
    readonly id: string;
    readonly writer: Writer;
    readonly $relations: JQuery<HTMLElement>;
    readonly $addButton: JQuery<HTMLElement>;
    readonly $removeButton: JQuery<HTMLElement>;
    currentlySelectedNode: any | null;
    constructor({ parentId, writer }: RelationsProps);
    /**
     * Update the list of relations.
     */
    update(): void;
    clear(): void;
    destroy(): void;
}
export default Relations;
//# sourceMappingURL=index.d.ts.map