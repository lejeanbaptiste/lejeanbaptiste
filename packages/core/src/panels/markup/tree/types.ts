import type { UniqueIdentifier } from '@dnd-kit/core';
import type { MutableRefObject } from 'react';

export type TreeItemType = 'tag' | 'text';

export interface TreeItem {
  id: UniqueIdentifier;
  children: TreeItem[];
  content?: string;
  isEntity?: boolean;
  label: string;
  nodeIndex?: number;
  parentId: UniqueIdentifier | null;
  parentName?: string;
  type?: TreeItemType;
  xpath?: string;
}

export type TreeItems = TreeItem[];

export interface FlattenedItem extends TreeItem {
  index: number;
  depth: number;
}

export type SensorContext = MutableRefObject<{
  items: FlattenedItem[];
  offset: number;
}>;
