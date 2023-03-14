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
  const { markupPanel } = useAppState().ui;

  const allowDND = useSetAtom(allowDNDAtom);
  const allowMultiselection = useSetAtom(allowMultiselectionAtom);
  const displayTextNodes = useSetAtom(displayTextNodesAtom);
  const displayTextNodeContent = useSetAtom(displayTextNodeContentAtom);

  useEffect(() => {
    allowDND(markupPanel.allowDragAndDrop);
    allowMultiselection(markupPanel.allowMultiselection);
    displayTextNodes(markupPanel.showTextNodes);
    displayTextNodeContent(markupPanel.showTextNodesContent);
  }, [
    markupPanel.allowDragAndDrop,
    markupPanel.allowMultiselection,
    markupPanel.showTextNodes,
    markupPanel.showTextNodesContent,
  ]);

  return <SortableTree />;
};
