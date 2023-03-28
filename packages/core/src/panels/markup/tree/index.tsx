import { useSetAtom } from 'jotai';
import React, { useEffect } from 'react';
import { useAppState } from '../../../overmind';
import { SortableTree } from './SortableTree';
import { allowDndAtom, displayTextNodesAtom } from './store';

export const Tree = () => {
  const { markupPanel } = useAppState().ui;

  const allowDND = useSetAtom(allowDndAtom);
  const displayTextNodes = useSetAtom(displayTextNodesAtom);

  useEffect(() => {
    allowDND(markupPanel.allowDragAndDrop);
    displayTextNodes(markupPanel.showTextNodes);
  }, [markupPanel.allowDragAndDrop, markupPanel.showTextNodes]);

  return <SortableTree />;
};
