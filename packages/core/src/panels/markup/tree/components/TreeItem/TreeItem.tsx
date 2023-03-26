import { alpha, ListItem, useTheme } from '@mui/material';
import classNames from 'classnames';
import React, { forwardRef, type HTMLAttributes, type MouseEvent } from 'react';
import type { TreeItemType } from '../../types';
import { Tag, Text } from './components';
import styles from './TreeItem.module.css';

export interface Props extends Omit<HTMLAttributes<HTMLLIElement>, 'id'> {
  expanded?: boolean;
  depth: number;
  canAddToMultiselection?: (id: string) => boolean;
  childCount?: number;
  clone?: boolean;
  content?: string;
  disableInteraction?: boolean;
  disableSelection?: boolean;
  expandDisabled?: boolean;
  ghost?: boolean;
  handleProps?: any;
  indentationWidth: number;
  isEntity?: boolean;
  isOver?: boolean;
  label: string;
  multipleSelection?: boolean;
  nodeId: string;
  onExpand?(): void;
  onSelectItem?: (
    event: MouseEvent<HTMLElement, Event>,
    { id, contentOnly }: { id: string; contentOnly?: boolean }
  ) => void;
  onContextMenuOpen?: (
    event: MouseEvent<HTMLElement, Event>,
    id: string,
    contentOnly?: boolean
  ) => void;
  selected?: boolean;
  type?: TreeItemType;
  wrapperRef?(node: HTMLLIElement): void;
}

export const TreeItem = forwardRef<HTMLDivElement, Props>(
  (
    {
      canAddToMultiselection,
      content,
      childCount,
      clone,
      disableInteraction,
      disableSelection,
      depth,
      expanded,
      expandDisabled,
      ghost,
      handleProps,
      indentationWidth,
      isEntity,
      isOver,
      label,
      multipleSelection,
      nodeId,
      onContextMenuOpen,
      onExpand,
      onSelectItem,
      selected,
      style,
      type,
      wrapperRef,
      ...props
    },
    ref
  ) => {
    const { palette } = useTheme();

    const itemProps = {
      canAddToMultiselection,
      //@ts-ignore
      classnames: [styles.TreeItem],
      content,
      expanded,
      expandDisabled,
      handleProps,
      isEntity,
      isOver,
      label,
      multipleSelection,
      nodeId,
      onContextMenuOpen,
      onExpand,
      onSelectItem,
      selected,
      style,
    };

    return (
      <ListItem
        ref={wrapperRef}
        className={classNames(
          //@ts-ignore
          styles.Wrapper,
          //@ts-ignore
          styles.indicator,
          //@ts-ignore
          clone && styles.clone,
          //@ts-ignores
          ghost && styles.ghost
        )}
        {...props}
        sx={{
          boxSizing: 'border-box',
          mb: '1px',
          py: 0,
          pr: 0,
          pl: `${indentationWidth * depth}px`,
          '--indicator-bgcolor': alpha(
            palette.primary[palette.mode],
            palette.action.selectedOpacity
          ),
          pointerEvents: disableInteraction ? 'none' : 'auto',
        }}
      >
        {type === 'text' ? (
          <Text ref={ref} {...itemProps}>
            {label}
          </Text>
        ) : (
          <Tag ref={ref} {...itemProps}>
            {label}
          </Tag>
        )}
      </ListItem>
    );
  }
);
