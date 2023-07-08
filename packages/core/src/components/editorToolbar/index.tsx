import { Box, Divider, Paper, Stack, useTheme } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useCallback, useRef } from 'react';
import type { IconLeafWriter } from '../../icons';
import { useActions, useAppState } from '../../overmind';
import { EntityType } from '../../types';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Toggle } from './Toggle';

type ItemType = 'button' | 'divider' | 'iconButton' | 'toggle';
type ItemGroup = 'action' | 'ui' | 'panel' | 'general';

export interface Item {
  disabled?: boolean;
  hide?: boolean;
  type: ItemType;
  group: ItemGroup;
}

export interface MenuItem extends Item {
  color?: string;
  group: ItemGroup;
  icon: IconLeafWriter;
  onClick?: () => void;
  selected?: boolean;
  title?: string;
  tooltip?: string;
}

export const EditorToolbar = () => {
  const { schemaId } = useAppState().document;
  const { isReadonly, showTags } = useAppState().editor;
  const { fullscreen } = useAppState().ui;

  const { toggleShowTags } = useActions().editor;
  const { openDialog, showContextMenu, toggleFullscreen } = useActions().ui;

  const { entity, spacing } = useTheme();

  const container = useRef<HTMLDivElement>(null);

  const isSupported = useCallback(
    (name: EntityType) => window.writer.schemaManager.mapper.getEntitiesMapping().has(name),
    [schemaId]
  );

  const items: (MenuItem | Item)[] = [
    {
      group: 'action',
      hide: isReadonly,
      icon: 'insertTag',
      onClick: () => {
        if (!container.current) return;

        const rect = container.current.getBoundingClientRect();
        const posX = rect.left;
        const posY = rect.top + 34;

        showContextMenu({
          // anchorEl: container.current,
          eventSource: 'ribbon',
          position: { posX, posY },
          useSelection: true,
        });
      },
      title: 'Tag',
      tooltip: 'Add Tag',
      type: 'button',
    },
    { group: 'action', type: 'divider', hide: isReadonly },
    {
      color: entity.person.color.main,
      group: 'action',
      disabled: !isSupported('person'),
      hide: isReadonly,
      icon: entity.person.icon,
      onClick: () => window.writer.tagger.addEntityDialog('person'),
      title: 'Tag Person',
      type: 'iconButton',
    },
    {
      color: entity.place.color.main,
      group: 'action',
      disabled: !isSupported('place'),
      hide: isReadonly,
      icon: entity.place.icon,
      onClick: () => window.writer.tagger.addEntityDialog('place'),
      title: 'Tag Place',
      type: 'iconButton',
    },
    {
      color: entity.organization.color.main,
      group: 'action',
      disabled: !isSupported('organization'),
      hide: isReadonly,
      icon: entity.organization.icon,
      onClick: () => window.writer.tagger.addEntityDialog('organization'),
      title: 'Tag Organization',
      type: 'iconButton',
    },
    {
      color: entity.title.color.main,
      group: 'action',
      disabled: !isSupported('title'),
      hide: isReadonly,
      icon: entity.title.icon,
      onClick: () => window.writer.tagger.addEntityDialog('title'),
      title: 'Tag Title',
      type: 'iconButton',
    },
    {
      color: entity.thing.color.main,
      group: 'action',
      disabled: !isSupported('rs'),
      hide: isReadonly,
      icon: entity.thing.icon,
      onClick: () => window.writer.tagger.addEntityDialog('rs'),
      title: 'Tag Thing',
      type: 'iconButton',
    },
    {
      color: entity.citation.color.main,
      group: 'action',
      disabled: !isSupported('citation'),
      hide: isReadonly,
      icon: entity.citation.icon,
      onClick: () => window.writer.tagger.addEntityDialog('citation'),
      title: 'Tag Citation',
      type: 'iconButton',
    },
    {
      color: entity.note.color.main,
      group: 'action',
      disabled: !isSupported('note'),
      hide: isReadonly,
      icon: entity.note.icon,
      onClick: () => window.writer.tagger.addEntityDialog('note'),
      title: 'Tag Note',
      type: 'iconButton',
    },
    {
      color: entity.date.color.main,
      group: 'action',
      disabled: !isSupported('date'),
      hide: isReadonly,
      icon: entity.date.icon,
      onClick: () => window.writer.tagger.addEntityDialog('date'),
      title: 'Tag Date',
      type: 'iconButton',
    },
    {
      color: entity.correction.color.main,
      group: 'action',
      disabled: !isSupported('correction'),
      hide: isReadonly,
      icon: entity.correction.icon,
      onClick: () => window.writer.tagger.addEntityDialog('correction'),
      title: 'Tag Correction',
      type: 'iconButton',
    },
    {
      color: entity.keyword.color.main,
      group: 'action',
      disabled: !isSupported('keyword'),
      hide: isReadonly,
      icon: entity.keyword.icon,
      onClick: () => window.writer.tagger.addEntityDialog('keyword'),
      title: 'Tag Keyword',
      type: 'iconButton',
    },
    {
      color: entity.link.color.main,
      group: 'action',
      disabled: !isSupported('link'),
      hide: isReadonly,
      icon: entity.link.icon,
      onClick: () => window.writer.tagger.addEntityDialog('link'),
      title: 'Tag Link',
      type: 'iconButton',
    },
    { group: 'action', type: 'divider', hide: isReadonly },
    {
      icon: 'translate',
      group: 'action',
      hide: isReadonly,
      onClick: () => window.writer.dialogManager.show('translation'),
      title: 'Add Translation',
      type: 'iconButton',
    },
    { group: 'action', type: 'divider', hide: isReadonly },
    {
      group: 'ui',
      icon: showTags ? 'showTagsOn' : 'showTagsOff',
      onClick: () => toggleShowTags(),
      selected: showTags,
      title: 'Show Tags',
      type: 'toggle',
    },
    {
      group: 'ui',
      icon: fullscreen ? 'fullscreenExit' : 'fullscreen',
      onClick: () => toggleFullscreen(),
      selected: fullscreen,
      title: 'Toggle Fullscreen',
      type: 'toggle',
    },
    { group: 'ui', type: 'divider', hide: isReadonly },
    {
      group: 'ui',
      hide: isReadonly,
      icon: 'validate',
      onClick: () => {
        window.writer.layoutManager.showModule('validation');
        window.writer.validate();
      },
      title: 'Validate',
      type: 'iconButton',
    },
    { group: 'ui', type: 'divider', hide: isReadonly },
    {
      group: 'ui',
      icon: 'settings',
      onClick: () => openDialog({ type: 'settings' }),
      title: 'Settings',
      type: 'iconButton',
    },

    {
      group: 'ui',
      icon: 'documentation',
      onClick: () => {
        window.open('https://www.leaf-vre.org/docs/documentation/leaf-writer-documentation');
      },
      title: 'Documentation',
      type: 'iconButton',
    },
  ];

  const ItemComponent = (item: MenuItem | Item) => {
    const BUTTON_TYPES: Record<ItemType, React.ReactNode> = {
      button: <Button {...(item as MenuItem)} />,
      iconButton: <IconButton {...(item as MenuItem)} />,
      toggle: <Toggle {...(item as MenuItem)} />,
      divider: (
        <Divider orientation="vertical" variant="middle" flexItem sx={{ width: spacing(2) }} />
      ),
    };
    return <>{BUTTON_TYPES[item.type]}</>;
  };

  const groups: ItemGroup[] = ['action', 'ui'];

  return (
    <Paper
      ref={container}
      elevation={5}
      square
      sx={{
        width: '100%',
        bgcolor: ({ palette }) => (palette.mode === 'dark' ? palette.background.paper : '#f5f5f5'),
      }}
      component={motion.div}
      layout="size"
    >
      <Stack
        direction="row"
        flexWrap="wrap"
        gap={0.25}
        px={0.5}
        py={0.25}
        component={motion.div}
        layout
        justifyContent="space-between"
      >
        <AnimatePresence mode="popLayout">
          {groups.map((group) => (
            <Stack key={group} direction="row" flexWrap="wrap">
              {items
                .filter((item) => !item.hide)
                .filter((item) => item.group === group)
                .map((item, index) => (
                  <Box
                    layout
                    key={'title' in item ? item.title : index}
                    component={motion.div}
                    initial={{ scale: 0, opacity: 0 }}
                    exit={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    <ItemComponent {...item} />
                  </Box>
                ))}
            </Stack>
          ))}
        </AnimatePresence>
      </Stack>
    </Paper>
  );
};
