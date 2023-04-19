import { Box, Button, Tooltip } from '@mui/material';
import React, { MouseEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../../../overmind';
import { Menu } from './Menu';

const EditorMode = () => {
  const { editorModeLabel } = useAppState().editor;
  const { t } = useTranslation('leafwriter');

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);

  const handleButtonClick = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  return (
    <Box>
      <Tooltip title={t('Editor Mode')}>
        <Button
          aria-controls="editor-mode-menu"
          aria-expanded={openMenu ? 'true' : undefined}
          aria-haspopup="true"
          id="editor-mode-select"
          onClick={handleButtonClick}
          size="small"
          sx={{ color: 'text.primary' }}
        >
          {editorModeLabel}
        </Button>
      </Tooltip>
      <Menu anchorEl={anchorEl} handleClose={handleMenuClose} />
    </Box>
  );
};

export default EditorMode;
