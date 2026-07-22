import { Box, Button, Tooltip } from '@mui/material';
import { MouseEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../overmind';
import { Menu } from './Menu';

export const Schema = () => {
  const { schemaId, schemaName } = useAppState().document;
  const { schemasList } = useAppState().editor;
  const { setInitialStateSchema } = useActions().document;
  const { t } = useTranslation();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);

  // Prefer overmind schemaId; fall back to the schema manager when document
  // state was cleared but the manager still has the active schema (tab reopen).
  const managerSchemaId = window.writer?.schemaManager?.schemaId ?? '';
  const effectiveSchemaId = schemaId || managerSchemaId || '';
  const label =
    schemaName ||
    schemasList.find((schema) => schema.id === effectiveSchemaId)?.name ||
    window.writer?.schemaManager?.getCurrentSchema?.()?.name ||
    effectiveSchemaId;

  useEffect(() => {
    if (schemaId || !managerSchemaId) return;
    setInitialStateSchema(managerSchemaId);
  }, [managerSchemaId, schemaId, setInitialStateSchema]);

  const handleButtonClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => setAnchorEl(null);

  if (!effectiveSchemaId) return null;

  return (
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
          {label}
        </Button>
      </Tooltip>
      <Menu anchorEl={anchorEl} handleClose={handleMenuClose} />
    </Box>
  );
};
