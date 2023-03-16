import { type UniqueIdentifier } from '@dnd-kit/core';
import { useAtomValue } from 'jotai';
import { v4 as uuidv4 } from 'uuid';
import { isElement, log } from '../../../utilities';
import { displayTextNodeContentAtom, displayTextNodesAtom } from './store';
import type { TreeItem } from './types';

export const useTree = () => {
  const displayTextNodeContent = useAtomValue(displayTextNodeContentAtom);
  const displayTextNodes = useAtomValue(displayTextNodesAtom);

  const getEditorTreeModel = () => {
    if (!window.writer) return null;

    const { editor, schemaManager } = window.writer;

    let treeModel: TreeItem;

    const documentRootNode =
      editor.getBody().querySelector(`[_tag="${schemaManager.getRoot()}"]`) ??
      editor.getBody().querySelector('[_tag]');

    const rootItem = processNode(documentRootNode);
    if (!rootItem) return;

    treeModel = getNodes({ node: documentRootNode });

    return [treeModel];
  };

  type GetNodesParams = {
    node: Node;
    level?: number;
    parent?: TreeItem;
  };

  /**
   * It takes a DOM element and returns a tree item
   * @param {GetItemsParams}  - an object with the following properties:
   * - `node` - the node to process
   * - `level` - the tree level
   * - `parent` - the tree item parent
   *
   * @returns A TreeItem with children.
   */
  const getNodes = ({ node, level = 0, parent }: GetNodesParams): TreeItem => {
    const { schemaManager } = window.writer;

    if (!displayTextNodes && !isElement(node)) return;

    const item = processNode(node);

    //Bypass document Header. Avoid children on 'edit' and completely on 'readonly'
    if (isElement(node) && node.getAttribute('_tag') === schemaManager.getHeader()) {
      return item;
    }

    let treeChildren: TreeItem[] = [];

    const nodeChildren =
      isElement(node) && !displayTextNodes
        ? Array.from(node.children)
        : Array.from(node.childNodes);

    nodeChildren.forEach((child) => {
      const childItem = getNodes({ node: child, level: level + 1, parent: item ?? parent });
      if (childItem) treeChildren.push(childItem);
    });

    //store children
    if (treeChildren.length > 0) {
      if (item) {
        item.children = treeChildren;
      } else if (parent) {
        //flat into parent if item is undefined
        parent.children = [...parent.children, ...treeChildren];
      }
    }

    if (!item) return;

    return item;
  };

  /**
   * It takes a node, checks if it's an element, and if it is, it returns a treeItem object with type 'element'.
   * If it's not an element, a treeItem object with type 'node'.
   * content, children, and type
   * @param {Node} node - the node to process
   * @returns A treeItem object
   */
  const processNode = (node: Node) => {
    if (!isElement(node)) {
      // * remove comments to ignore nodes with tab and line-breaks
      // const trimmedContent = node.textContent.replaceAll(/\\n|\\t|\\r/g, '').trim();
      // if (trimmedContent === '') return;

      //* remove comments to ignore nodes without siblings
      // if (node.previousSibling === null && node.nextSibling === null) return null;

      const content = displayTextNodeContent ? node.textContent : '#text';

      const item: TreeItem = {
        id: uuidv4(),
        label: content,
        children: [],
        type: 'node',
      };

      return item;
    }

    const id = node.getAttribute('id') ?? node.getAttribute('name');
    const isEntity = !!node.getAttribute('_entity');
    let tag = node.getAttribute('_tag');

    if (!id) {
      log.info('markup panel: no id for', tag);
      return;
    }

    const item: TreeItem = {
      id,
      label: tag,
      children: [],
      isEntity,
      type: 'element',
    };

    return item;
  };

  type MoveNodeParams = {
    childIndex: number;
    dragId: UniqueIdentifier;
    dropId: UniqueIdentifier;
    position?: 'after' | 'before';
  };

  const moveNode = ({ childIndex, dragId, dropId, position = 'after' }: MoveNodeParams): void => {
    const { writer } = window;
    const { schemaManager } = writer;

    let dragNodeEditor = writer.editor.getBody().querySelector(`#${dragId}`);
    const dropNodeEditor = writer.editor.getBody().querySelector(`#${dropId}`);

    if (!dropNodeEditor) return;
    if ([schemaManager.getRoot(), schemaManager.getHeader()].includes(dropNodeEditor.id)) {
      return;
    }

    //TODO
    // const parentNotes = parents(dragNodeEditor, '.noteWrapper');
    // if (parentNotes.length > 0) dragNodeEditor = parentNotes[0];

    //TODO
    // if (isCopy) dragNodeEditor = dragNodeEditor.cloneNode(true);

    if (childIndex === 0) {
      dropNodeEditor.prepend(dragNodeEditor);
    } else {
      const prevSibiling = dropNodeEditor.childNodes.item(childIndex);
      if (prevSibiling) {
        position === 'after'
          ? prevSibiling.after(dragNodeEditor)
          : prevSibiling.before(dragNodeEditor);
      } else {
        dropNodeEditor.prepend(dragNodeEditor);
      }
    }

    //TODO
    // if (isCopy) writer.tagger.processNewContent(dragNodeEditor as Element);

    writer.editor.undoManager.add();
    setTimeout(() => writer.event('contentChanged').publish(), 1000);
  };

  return {
    getEditorTreeModel,
    moveNode,
  };
};
