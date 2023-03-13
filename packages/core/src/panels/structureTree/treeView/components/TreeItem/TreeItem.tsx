import { alpha, ListItem, useTheme } from '@mui/material';
import classNames from 'classnames';
import React, { forwardRef, type HTMLAttributes, type MouseEvent } from 'react';
import type { TreeItemType } from '../../types';
import { ElementTag, TextNode } from './components';
import styles from './TreeItem.module.css';

export interface Props extends Omit<HTMLAttributes<HTMLLIElement>, 'id'> {
  expanded?: boolean;
  depth: number;
  canAddToMultiselection?: (id: string) => boolean;
  childCount?: number;
  clone?: boolean;
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
      depth,
      childCount,
      clone,
      disableInteraction,
      disableSelection,
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
      onExpand,
      onSelectItem,
      onContextMenuOpen,
      selected,
      style,
      wrapperRef,
      type,
      ...props
    },
    ref
  ) => {
    const { palette } = useTheme();

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
            palette.action.selectedOpacity
          ),
          pointerEvents: disableInteraction ? 'none' : 'auto',
        }}
      >
        {type === 'node' ? (
          <TextNode style={style}>{label}</TextNode>
        ) : (
          <ElementTag
            ref={ref}
            {...{
              classnames: [styles.TreeItem],
              canAddToMultiselection,
              expanded,
              expandDisabled,
              handleProps,
              isEntity,
              isOver,
              label,
              multipleSelection,
              nodeId,
              onExpand,
              onSelectItem,
              onContextMenuOpen,
              selected,
              style,
            }}
          >
            {label}
          </ElementTag>
        )}
      </ListItem>
    );
  }
);
