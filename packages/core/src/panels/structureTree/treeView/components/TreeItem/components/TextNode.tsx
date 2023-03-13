import TagRoundedIcon from '@mui/icons-material/TagRounded';
import { ListItemButton, Typography } from '@mui/material';
import classNames from 'classnames';
import React from 'react';
import { ElementIcon } from './ElementIcon';

type TextNodeProps = {
  classnames?: string[];
  children: React.ReactNode;
  style: React.CSSProperties;
};

export const TextNode = ({ classnames, children, style }: TextNodeProps) => {
  return (
    <ListItemButton
      className={classNames(classnames)}
      style={style}
      sx={{ py: 0.25, px: 0.5, gap: 0.5, borderRadius: 1 }}
    >
      <ElementIcon icon={TagRoundedIcon} />
      <Typography
        sx={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', opacity: 0.6 }}
        variant="caption"
      >
        {children}
      </Typography>
    </ListItemButton>
  );
};
