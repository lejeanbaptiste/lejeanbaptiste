import { useSetAtom } from 'jotai';
import React, { useEffect } from 'react';
import { useAppState } from '../../../overmind';
import { SortableTree } from './SortableTree';
import {
  allowDNDAtom,
  allowMultiselectionAtom,
  displayTextNodeContentAtom,
  displayTextNodesAtom,
} from './store';

export const TreeView = () => {
  const { structurePanel } = useAppState().ui;

  const allowDND = useSetAtom(allowDNDAtom);
  const allowMultiselection = useSetAtom(allowMultiselectionAtom);
  const displayTextNodes = useSetAtom(displayTextNodesAtom);
  const displayTextNodeContent = useSetAtom(displayTextNodeContentAtom);

  useEffect(() => {
    allowDND(structurePanel.allowDragAndDrop);
    allowMultiselection(structurePanel.allowMultiselection);
    displayTextNodes(structurePanel.showTextNodes);
    displayTextNodeContent(structurePanel.showTextNodesContent);
  }, [
    structurePanel.allowDragAndDrop,
    structurePanel.allowMultiselection,
    structurePanel.showTextNodes,
    structurePanel.showTextNodesContent,
  ]);

  return <SortableTree />;
};
