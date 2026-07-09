import { Button, DialogActions } from '@mui/material';
import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import type { EntityLink } from '../../types/authority';
import {
  entityTypeAtom,
  isUriValidAtom,
  manualInputAtom,
  onCloseAtom,
  queryAtom,
  resolutionAtom,
  selectedAtom,
} from './store';
import { useEntityLookup } from './useEntityLookup';

export const Footer = () => {
  const { t } = useTranslation();

  const entityType = useAtomValue(entityTypeAtom);
  const isUriValid = useAtomValue(isUriValidAtom);
  const manualInput = useAtomValue(manualInputAtom);
  const onClose = useAtomValue(onCloseAtom);
  const query = useAtomValue(queryAtom);
  const resolution = useAtomValue(resolutionAtom);
  const selected = useAtomValue(selectedAtom);

  const { confirmSelected } = useEntityLookup();

  const handlSelectLink = () => void confirmSelected();

  const handleClose = (link?: EntityLink | Pick<EntityLink, 'query' | 'type'>) => {
    onClose?.(link);
  };

  return (
    <DialogActions
      sx={{
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopStyle: 'solid',
        borderTopColor: (theme) => theme.vars.palette.divider,
      }}
    >
      <Button onClick={() => handleClose()} variant="text">
        {t('LW.commons.cancel')}
      </Button>
      <Button onClick={() => query && handleClose({ type: entityType, query })} variant="text">
        {t('LW.lookups.tag without linking')}
      </Button>
      <Button
        autoFocus
        disabled={(!selected && (manualInput === '' || !isUriValid)) || resolution !== null}
        onClick={handlSelectLink}
        variant="contained"
      >
        {t('LW.commons.select')}
      </Button>
    </DialogActions>
  );
};
