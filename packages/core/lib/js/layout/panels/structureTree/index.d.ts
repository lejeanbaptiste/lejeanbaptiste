import 'jstree';
import Writer from '../../../Writer';
interface StructureTreeProps {
    parentId: string;
    writer: Writer;
}
declare class StructureTree {
    readonly id: string;
    readonly writer: Writer;
    readonly NODE_SELECTED = 0;
    readonly CONTENTS_SELECTED = 1;
    readonly tagFilter: string[];
    currentlySelectedNodes: any[];
    selectionType: 0 | 1 | null;
    ignoreSelect: boolean;
    readonly $tree: JQuery<HTMLElement>;
    initialized: boolean;
    updatePending: boolean;
    enabled: boolean;
    constructor({ parentId, writer }: StructureTreeProps);
    private handleDnDStart;
    private handleDnDMove;
    /**
     * Updates the tree to reflect the document structure.
     */
    update(): void;
    clear(): void;
    enable(forceUpdate: boolean): void;
    disable(): void;
    destroy(): void;
    /**
     * Expands the parents of a particular node. Returns the ID of the header if the node was inside the document header.
     * @param {Element} node A node that exists in the editor
     * @returns {String | null} The header ID if the node was inside of it
     */
    private expandParentsForNode;
    /**
     * Displays (if collapsed) and highlights a node in the tree based on a node in the editor
     * @param {Element} node A node that exists in the editor
     */
    private highlightNode;
    private scrollIntoView;
    /**
     * Selects a node in the tree based on a node in the editor
     * @param {String} id The id of the node
     * @param {Boolean} selectContents True to select contents
     */
    selectNode(id: string, selectContents: boolean): void;
    /**
     * Performs actual selection of a tree node
     * @param {Element} $node A jquery node (LI) in the tree
     * @param {Boolean} selectContents True to select contents
     * @param {Boolean} multiselect True if ctrl or select was held when selecting
     * @param {Boolean} external True if selectNode came from outside structureTree, i.e. tree.selectNode
     */
    private doSelectNode;
    /**
     * Processes an element in the editor and returns relevant data for the tree
     * @param node A jQuery object
     * @param level The current tree depth
     */
    private processNode;
    /**
     * Recursively work through all elements in the editor and create the data for the tree.
     */
    private doUpdate;
    private doConditionalSelect;
    private onNodeSelect;
    private isSelectedContents;
    private isMultiselect;
    private onNodeDeselect;
    private onDragDrop;
    private removeCustomClasses;
    private showPopup;
    private hidePopup;
}
export default StructureTree;
//# sourceMappingURL=index.d.ts.map