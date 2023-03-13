import type { UniqueIdentifier } from '@dnd-kit/core';
import type { MutableRefObject } from 'react';

export type TreeItemType = 'element' | 'node';

export interface TreeItem {
  id: UniqueIdentifier;
  label: string;
  children: TreeItem[];
  isEntity?: boolean;
  type?: TreeItemType;
}

export type TreeItems = TreeItem[];

export interface FlattenedItem extends TreeItem {
  parentId: UniqueIdentifier | null;
  depth: number;
  index: number;
}

export type SensorContext = MutableRefObject<{
  items: FlattenedItem[];
  offset: number;
}>;
