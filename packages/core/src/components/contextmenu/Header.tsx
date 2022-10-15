import type { ElementDetail } from '@cwrc/leafwriter-validator';
import { Box, Tooltip, Typography } from '@mui/material';
import React, { useEffect, useState, type FC } from 'react';

interface HeaderProps {
  tagMeta?: ElementDetail;
  tagName?: string;
  xpath?: string;
}

const Header: FC<HeaderProps> = ({ tagMeta, tagName = '', xpath = '' }) => {
  const [title, setTitle] = useState(tagName);
  const [fullName, setFullName] = useState<string>();

  useEffect(() => {
    if (!tagMeta) return;
    if (!tagMeta.fullName) return;
    setFullName(tagMeta.fullName);
  }, [tagMeta]);

  return (
    <Tooltip enterDelay={2500} placement="top" title={xpath}>
      <Box
        display="flex"
        justifyContent="center"
        mt={-0.5}
        mb={0.5}
        sx={{
          cursor: 'default',
          background: ({ palette }) => palette.action.selected,
        }}
      >
        <Typography variant="caption">
          {`<${title}>`}
          {fullName && (
            <Typography component="span" sx={{ textTransform: 'capitalize' }} variant="caption">
              {` ${fullName}`}
            </Typography>
          )}
        </Typography>
      </Box>
    </Tooltip>
  );
};

export default Header;
