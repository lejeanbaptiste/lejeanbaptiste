import { Box, Button, Tooltip } from '@mui/material';
import React, { useState, type FC, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../../../overmind';
import { Menu } from './Menu';

const AnnotationMode: FC = () => {
  const { annotationModeLabel, isReadonly } = useAppState().editor;
  const { t } = useTranslation(['leafwriter']);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);

  const handleButtonClick = (event: MouseEvent<HTMLElement>) => {
    // setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => setAnchorEl(null);

  return (
    <Box>
      <Tooltip title={t('Annotation Mode')}>
        <Button
          id="annotation-mode-select"
          aria-controls="annotation-mode-menu"
          aria-expanded={openMenu ? 'true' : undefined}
          aria-haspopup="true"
          // disabled={isReadonly}
          disableRipple
          onClick={handleButtonClick}
          size="small"
          sx={{ color: 'text.primary', cursor: 'default' }}
        >
          {annotationModeLabel}
        </Button>
      </Tooltip>
      <Menu anchorEl={anchorEl} handleClose={handleMenuClose} />
    </Box>
  );
};

export default AnnotationMode;
