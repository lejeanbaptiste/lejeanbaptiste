import { Box, Divider, Paper, Stack, useTheme } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { IconLeafWriter } from '../../icons';
import { useActions, useAppState } from '../../overmind';
import { EntityType } from '../../types';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Toggle } from './Toggle';

type ItemType = 'button' | 'divider' | 'iconButton' | 'toggle';

export interface MenuItem {
  color?: string;
  disabled?: boolean;
  icon?: IconLeafWriter;
  hide?: boolean;
  onClick?: () => void;
  selected?: boolean;
  title?: string;
  tooltip?: string;
  type: ItemType;
}

export const EditorToolbar = () => {
  const { schemaId } = useAppState().document;
  const { isReadonly, showTags } = useAppState().editor;
  const { fullscreen } = useAppState().ui;

  const { toggleShowTags } = useActions().editor;
  const { openDialog, showContextMenu, toggleFullscreen } = useActions().ui;

  const { entity } = useTheme();

  const container = useRef<HTMLDivElement>(null);

  const isSupported = useCallback(
    (name: EntityType) => window.writer.schemaManager.mapper.getEntitiesMapping().has(name),
    [schemaId]
  );

  const items: MenuItem[] = [
    {
      hide: isReadonly,
      icon: 'insertTag',
      onClick: () => {
        if (!container.current) return;

        const rect = container.current.getBoundingClientRect();
        const posX = rect.left;
        const posY = rect.top + 34;

        showContextMenu({
          show: true,
          eventSource: 'ribbon',
          position: { posX, posY },
          useSelection: true,
        });
      },
      title: 'Tag',
      tooltip: 'Add Tag',
      type: 'button',
    },
    { type: 'divider', hide: isReadonly },
    {
      color: entity.person.color.main,
      disabled: !isSupported('person'),
      hide: isReadonly,
      icon: entity.person.icon,
      onClick: () => window.writer.tagger.addEntityDialog('person'),
      title: 'Tag Person',
      type: 'iconButton',
    },
    {
      color: entity.place.color.main,
      disabled: !isSupported('place'),
      hide: isReadonly,
      icon: entity.place.icon,
      onClick: () => window.writer.tagger.addEntityDialog('place'),
      title: 'Tag Place',
      type: 'iconButton',
    },
    {
      color: entity.organization.color.main,
      disabled: !isSupported('organization'),
      hide: isReadonly,
      icon: entity.organization.icon,
      onClick: () => window.writer.tagger.addEntityDialog('organization'),
      title: 'Tag Organization',
      type: 'iconButton',
    },
    {
      color: entity.title.color.main,
      disabled: !isSupported('title'),
      hide: isReadonly,
      icon: entity.title.icon,
      onClick: () => window.writer.tagger.addEntityDialog('title'),
      title: 'Tag Title',
      type: 'iconButton',
    },
    {
      color: entity.thing.color.main,
      disabled: !isSupported('rs'),
      hide: isReadonly,
      icon: entity.thing.icon,
      onClick: () => window.writer.tagger.addEntityDialog('rs'),
      title: 'Tag Thing',
      type: 'iconButton',
    },
    {
      color: entity.citation.color.main,
      disabled: !isSupported('citation'),
      hide: isReadonly,
      icon: entity.citation.icon,
      onClick: () => window.writer.tagger.addEntityDialog('citation'),
      title: 'Tag Citation',
      type: 'iconButton',
    },
    {
      color: entity.note.color.main,
      disabled: !isSupported('note'),
      hide: isReadonly,
      icon: entity.note.icon,
      onClick: () => window.writer.tagger.addEntityDialog('note'),
      title: 'Tag Note',
      type: 'iconButton',
    },
    {
      color: entity.date.color.main,
      disabled: !isSupported('date'),
      hide: isReadonly,
      icon: entity.date.icon,
      onClick: () => window.writer.tagger.addEntityDialog('date'),
      title: 'Tag Date',
      type: 'iconButton',
    },
    {
      color: entity.correction.color.main,
      disabled: !isSupported('correction'),
      hide: isReadonly,
      icon: entity.correction.icon,
      onClick: () => window.writer.tagger.addEntityDialog('correction'),
      title: 'Tag Correction',
      type: 'iconButton',
    },
    {
      color: entity.keyword.color.main,
      disabled: !isSupported('keyword'),
      hide: isReadonly,
      icon: entity.keyword.icon,
      onClick: () => window.writer.tagger.addEntityDialog('keyword'),
      title: 'Tag Keyword',
      type: 'iconButton',
    },
    {
      color: entity.link.color.main,
      disabled: !isSupported('link'),
      hide: isReadonly,
      icon: entity.link.icon,
      onClick: () => window.writer.tagger.addEntityDialog('link'),
      title: 'Tag Link',
      type: 'iconButton',
    },
    {
      icon: 'translate',
      hide: isReadonly,
      onClick: () => window.writer.dialogManager.show('translation'),
      title: 'Add Translation',
      type: 'iconButton',
    },
    { type: 'divider', hide: isReadonly },
    {
      icon: showTags ? 'showTagsOn' : 'showTagsOff',
      onClick: () => toggleShowTags(),
      selected: showTags,
      title: 'Show Tags',
      type: 'toggle',
    },
    {
      icon: fullscreen ? 'fullscreenExit' : 'fullscreen',
      onClick: () => toggleFullscreen(),
      selected: fullscreen,
      title: 'Toggle Fullscreen',
      type: 'toggle',
    },
    { type: 'divider', hide: isReadonly },
    {
      hide: isReadonly,
      icon: 'code',
      onClick: () => window.writer.selection.showSelection(),
      title: 'Show Raw XML',
      type: 'iconButton',
    },
    {
      hide: isReadonly,
      icon: 'validate',
      onClick: () => {
        window.writer.layoutManager.showModule('validation');
        window.writer.validate();
      },
      title: 'Validate',
      type: 'iconButton',
    },
    { type: 'divider', hide: isReadonly },
    {
      icon: 'settings',
      onClick: () => openDialog({ type: 'settings' }),
      title: 'Settings',
      type: 'iconButton',
    },

    {
      icon: 'documentation',
      onClick: () => {
        window.open('https://www.leaf-vre.org/docs/documentation/leaf-writer-documentation');
      },
      title: 'Documentation',
      type: 'iconButton',
    },
  ];

  const ItemComponent = (item: MenuItem) => {
    const BUTTON_TYPES: Record<ItemType, React.ReactNode> = {
      button: <Button {...item} />,
      iconButton: <IconButton {...item} />,
      toggle: <Toggle {...item} />,
      divider: <Divider orientation="vertical" variant="middle" flexItem />,
    };
    return <>{BUTTON_TYPES[item.type]}</>;
  };

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
      >
        <AnimatePresence mode="popLayout">
          {items
            .filter((item) => !item.hide)
            .map((item) => (
              <Box
                layout
                key={item.title ?? uuidv4()}
                component={motion.div}
                initial={{ scale: 0, opacity: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                <ItemComponent key={item.title ?? uuidv4()} {...item} />
              </Box>
            ))}
        </AnimatePresence>
      </Stack>
    </Paper>
  );
};
