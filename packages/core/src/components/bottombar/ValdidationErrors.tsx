import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Button, Stack, Tooltip, Typography } from '@mui/material';
import React, { type FC } from 'react';
import { useAppState } from '../../overmind';

export const ValdidationErrors: FC = () => {
  const { validationErrors } = useAppState().validator;

  const handleClick = () => {
    window.writer.validate();
  };

  return (
    <Tooltip title="Annotation Mode">
      <Button
        id="annotation-mode-select"
        color="warning"
        onClick={handleClick}
        size="small"
        startIcon={<WarningAmberIcon />}
      >
        {validationErrors}
      </Button>
    </Tooltip>
  );
};
