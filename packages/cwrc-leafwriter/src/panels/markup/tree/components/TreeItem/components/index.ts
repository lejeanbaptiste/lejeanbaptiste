import type { MouseEvent } from 'react';

export * from './ExpandButton';
export * from './Icon';
export * from './Label';
export * from './SelectionBadge';
export * from './Tag';
export * from './Text';

interface Item {
  id: string;
  contentOnly?: boolean;
}

export interface ItemProps {
  canAddToMultiselection?: (id: string) => boolean;
  classnames?: (string | undefined)[];
  content?: string;
  expandDisabled?: boolean;
  handleProps?: any;
  isOver?: boolean;
  label: string;
  nodeId: string;
  onContextMenuOpen?: (event: MouseEvent<HTMLElement, Event>, item: Item) => void;
  onExpand?: () => void;
  onSelectItem?: (event: MouseEvent<HTMLElement, Event>, item: Item) => void;
  selected?: boolean;
}
