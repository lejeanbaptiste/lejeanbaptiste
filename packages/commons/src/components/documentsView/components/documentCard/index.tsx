import ClearIcon from '@mui/icons-material/Clear';
import { Card, Icon, IconButton, Stack, Typography, useTheme } from '@mui/material';
import { getIcon } from '@src/assets/icons';
import type { Resource } from '@src/types';
import { formatDistanceToNow } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useState, type FC, type MouseEvent } from 'react';
import type { DisplayLayout } from '../..';
import { CoverImage } from './CoverImage';
import { Path } from './Path';

interface DocumentCardProps {
  deletable?: boolean;
  displayLayout?: DisplayLayout;
  onClick: (resource: Resource) => void;
  onDoubleClick?: (resource: Resource) => void;
  onRemove?: (url: string) => void;
  selected?: Resource;
  resource: Resource;
  width?: number;
}

export const CARD_WIDTH = 250;

const ENABLE_SNAPSHOT = true;

export const DocumentCard: FC<DocumentCardProps> = ({
  displayLayout,
  deletable = false,
  onClick,
  onDoubleClick,
  onRemove,
  selected,
  resource,
  width = CARD_WIDTH,
}) => {
  const { palette } = useTheme();

  const [hover, setHover] = useState(false);

  const { filename, icon, modifiedAt, owner, path, provider, repo, screenshot, title, url } =
    resource;

  const isSample = !!owner;

  const lastDate = modifiedAt
    ? formatDistanceToNow(new Date(modifiedAt), {
        includeSeconds: true,
        addSuffix: true,
      })
    : '';

  const handleClick = async () => onClick(resource);

  const handleDoubleClick = () => onDoubleClick && onDoubleClick(resource);

  const handleRemove = (event: MouseEvent<HTMLButtonElement, globalThis.MouseEvent>) => {
    if (!onRemove || !url) return;
    event.preventDefault();
    event.stopPropagation();

    if (!url) return;
    onRemove(url);
  };

  const cardVariant = {
    list: { width: '100%' },
    grid: { width },
  };

  return (
    <Card
      elevation={isSample || displayLayout === 'grid' ? 1 : 0}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      sx={{
        backgroundColor:
          selected?.url === url
            ? palette.primary[palette.mode]
            : hover
            ? palette.action.hover
            : 'inherit',
        color: selected?.url === url ? palette.common.white : 'inherit',
        cursor: 'pointer',
      }}
      component={motion.div}
      // layout
      variants={cardVariant}
      animate={displayLayout}
      initial={displayLayout}
      exit={{ scale: 0.8, opacity: 0 }}
    >
      <Stack>
        <AnimatePresence>
          {ENABLE_SNAPSHOT && displayLayout === 'grid' && screenshot && (
            <CoverImage hover={hover} image={screenshot} width={width} />
          )}
        </AnimatePresence>

        <Stack direction="column" py={1} px={2}>
          <Stack direction="row" alignItems="baseline" justifyContent="space-between">
            <Stack direction="row" alignItems="flex-start" gap={2}>
              {icon && (
                <Icon
                  color={hover ? 'primary' : 'inherit'}
                  component={getIcon(icon ?? 'blankPage')}
                  fontSize="small"
                  sx={{ mt: 0.5 }}
                />
              )}
              <Typography color={hover ? 'primary' : 'inherit'} variant="subtitle1">
                {title ?? filename}
              </Typography>
            </Stack>

            {deletable && (
              <IconButton onClick={handleRemove} size="small">
                <ClearIcon fontSize="inherit" />
              </IconButton>
            )}
          </Stack>

          {lastDate && (
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              {lastDate}
            </Typography>
          )}
        </Stack>
        {provider && owner && repo && <Path {...{ owner, path, provider, repo }} />}
      </Stack>
    </Card>
  );
};
