import { Button, DialogActions } from '@mui/material';
import React from 'react';
import { useActions, useAppState } from '../../overmind';
import type { EntityLink } from './types';

const Footer = () => {
  const { type } = useAppState().ui.entityLookupDialogProps;
  const { closeEntityLookupsDialog } = useActions().ui;
  const { isUriValid, query, selected, manualInput } = useAppState().lookups;
  const { processSelected } = useActions().lookups;

  const handleNoLink = () => {
    if (!type) return;
    handleClose({ type, query });
  };

  const handlSelectLink = () => {
    const link = processSelected();
    if (!link) return;

    handleClose(link);
  };

  const handleCancel = () => {
    handleClose();
  };

  const handleClose = (link?: EntityLink | Pick<EntityLink, 'query' | 'type'>) => {
    closeEntityLookupsDialog(link);
  };

  return (
    <DialogActions
      sx={{
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopStyle: 'solid',
        borderTopColor: ({ palette }) => palette.divider,
      }}
    >
      <Button autoFocus onClick={handleCancel} variant="text">
        Cancel
      </Button>
      <Button onClick={handleNoLink} variant="text">
        Tag without Linking
      </Button>
      <Button
        disabled={!selected && (manualInput === '' || !isUriValid)}
        onClick={handlSelectLink}
        variant="contained"
      >
        Select
      </Button>
    </DialogActions>
  );
};

export default Footer;
