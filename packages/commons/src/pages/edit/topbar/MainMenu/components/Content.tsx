import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { SxProps } from '@mui/material';
import { Box, Icon, Theme, Typography } from '@mui/material';
import { getIcon, type IconName } from '@src/icons';
import React from 'react';

export interface ContentProps {
  children: React.ReactNode;
  hasChildren?: boolean;
  icon?: IconName;
  shortcut?: string;
  sx?: SxProps<Theme>;
}

export const Content = ({
  children,
  hasChildren,
  icon,
  shortcut,
  sx = { textTransform: 'capitalize' },
}: ContentProps) => {

  const showShortCut = false;

  return (
    <>
      {icon && <Icon component={getIcon(icon)} fontSize="small" />}
      <Box sx={{ flexGrow: 1 }}>
        <Typography sx={{ ...sx }} variant="body2">
          {children}
        </Typography>
      </Box>
      {hasChildren ? (
        <ChevronRightIcon fontSize="small" />
      ) : (
        shortcut && showShortCut && (
          <Typography color="GrayText" variant="caption">
            {shortcut}
          </Typography>
        )
      )}
    </>
  );
};
