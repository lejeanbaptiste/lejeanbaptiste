import { alpha, ListItem, useTheme } from '@mui/material';
import classNames from 'classnames';
import React, { forwardRef, type HTMLAttributes } from 'react';
import type { TreeItemType } from '../../types';
import { Tag, Text, type ItemProps } from './components';
import styles from './TreeItem.module.css';

export interface TreeItemProps extends Omit<HTMLAttributes<HTMLLIElement>, 'id'>, ItemProps {
  expanded?: boolean;
  depth: number;
  childCount?: number;
  clone?: boolean;
  disableInteraction?: boolean;
  disableSelection?: boolean;
  ghost?: boolean;
  indentationWidth: number;
  isEntity?: boolean;
  multipleSelection?: boolean;
  type?: TreeItemType;
  wrapperRef?(node: HTMLLIElement): void;
}

export const TreeItem = forwardRef<HTMLDivElement, TreeItemProps>(
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
    ref,
  ) => {
    const { palette } = useTheme();

    const itemProps = {
      canAddToMultiselection,
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
          styles.Wrapper,
          styles.indicator,
          clone && styles.clone,
          ghost && styles.ghost,
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
            palette.action.selectedOpacity,
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
  },
);
