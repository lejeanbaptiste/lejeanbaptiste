import ClearIcon from '@mui/icons-material/Clear';
import { alpha, Box, Card, Icon, IconButton, Stack, Typography, useTheme } from '@mui/material';
import { getIcon, IconName } from '@src/icons';
import type { Resource } from '@src/types';
import { formatDistanceToNow } from 'date-fns';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import React, { useState, type MouseEvent } from 'react';
import type { Layout } from '../..';
import { CoverImage } from './CoverImage';
import { Footer } from './Footer';

interface DocumentCardProps extends Resource {
  deletable?: boolean;
  layout?: Layout;
  onClick: (resource: Resource) => void;
  onDoubleClick?: (resource: Resource) => void;
  onRemove?: (url: string) => void;
  selected?: boolean;
  width?: number;
}

export const CARD_WIDTH = 250;

const ENABLE_SNAPSHOT = true;

export const DocumentCard = ({
  deletable = false,
  layout,
  onClick,
  onDoubleClick,
  onRemove,
  selected,
  width = CARD_WIDTH,
  ...resource
}: DocumentCardProps) => {
  const { palette } = useTheme();

  const [hover, setHover] = useState(false);

  const { filename, id, icon, modifiedAt, owner, path, provider, repo, screenshot, title } =
    resource;

  const lastDate = modifiedAt
    ? formatDistanceToNow(new Date(modifiedAt), {
        includeSeconds: true,
        addSuffix: true,
      })
    : '';

  const handleClick = async () => onClick(resource);

  const handleDoubleClick = () => onDoubleClick && onDoubleClick(resource);

  const handleRemove = (event: MouseEvent<HTMLButtonElement, globalThis.MouseEvent>) => {
    if (!onRemove || !id) return;
    event.preventDefault();
    event.stopPropagation();

    onRemove(id);
  };

  let fullPath = `${owner}: ${repo}`;
  fullPath = path ? `${fullPath}/${path}` : fullPath;

  const cardVariant: Variants = {
    list: { width: '100%', transition: { delay: 0.5 } },
    grid: { width },
  };

  return (
    <Card
      elevation={0}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      sx={{
        bgcolor: selected
          ? alpha(palette.primary[palette.mode], 0.15)
          : hover
          ? alpha(palette.primary[palette.mode], palette.action.selectedOpacity)
          : alpha(palette.primary[palette.mode], palette.action.hoverOpacity),
        borderStyle: 'solid',
        borderColor: selected ? alpha(palette.primary.main, 0.5) : 'transparent',
        borderWidth: 1,
        boxShadow: selected ? `0 0 4px ${alpha(palette.primary.main, 0.5)}` : 'none',
        cursor: 'pointer',
      }}
      component={motion.div}
      variants={cardVariant}
      animate={layout}
      initial={layout}
      exit={{ scale: 0.8, opacity: 0 }}
    >
      <Stack>
        <AnimatePresence>
          {ENABLE_SNAPSHOT && layout === 'grid' && screenshot && (
            <CoverImage expanded={hover || !!selected} image={screenshot} width={width} />
          )}
        </AnimatePresence>

        <Stack direction="column" py={1} pl={2} pr={1}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems={layout === 'list' ? 'center' : 'flex-start'}
          >
            <Stack direction="row" alignItems="flex-start" gap={2}>
              {icon && (
                <Icon
                  color={hover ? 'primary' : 'inherit'}
                  component={getIcon(icon)}
                  fontSize="small"
                  sx={{ mt: 0.5 }}
                />
              )}
              <Typography color={hover ? 'primary' : 'inherit'} fontWeight={700} variant="body2">
                {title ?? filename}
              </Typography>
            </Stack>
            {deletable && (
              <Box width={26} height={26} mt={-0.5} mr={-0.5}>
                <AnimatePresence>
                  {(hover || selected) && (
                    <IconButton
                      component={motion.button}
                      animate={{ scale: 1, transition: { delay: 0.2 } }}
                      initial={{ scale: 0 }}
                      exit={{ scale: 0 }}
                      onClick={handleRemove}
                      size="small"
                    >
                      <ClearIcon sx={{ width: 14, height: 14 }} />
                    </IconButton>
                  )}
                </AnimatePresence>
              </Box>
            )}
          </Stack>
          {lastDate && layout === 'grid' && (
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              {lastDate}
            </Typography>
          )}
        </Stack>
        {provider && owner && repo && (
          <Footer
            icon={provider as IconName}
            lastDate={layout === 'list' ? lastDate : undefined}
            path={fullPath}
          />
        )}
      </Stack>
    </Card>
  );
};
