import { Box, Button, Grow, Tooltip } from '@mui/material';
import { MouseEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../../../overmind';
import { Menu } from './Menu';

export const Schema = () => {
  const { schemaId, schemaName } = useAppState().document;
  const { t } = useTranslation();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);

  const handleButtonClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => setAnchorEl(null);

  return (
    <Grow in={schemaId !== ''}>
      <Box>
        <Tooltip title={t('LW.commons.schemas')} sx={{ textTransform: 'capitalize' }}>
          <Button
            aria-controls="schema-menu"
            aria-expanded={openMenu ? 'true' : undefined}
            aria-haspopup="true"
            id="schema-select"
            onClick={handleButtonClick}
            size="small"
            sx={{ color: 'text.primary' }}
          >
            {schemaName}
          </Button>
        </Tooltip>
        <Menu anchorEl={anchorEl} handleClose={handleMenuClose} />
      </Box>
    </Grow>
  );
};
