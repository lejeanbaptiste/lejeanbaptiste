import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { TemplatesView } from '@src/components';
import { useActions } from '@src/overmind';
import type { ISample } from '@src/types';
import React, { useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { v4 as uuidv4 } from 'uuid';
import type { IDialog } from './type';

export const TemplateDialog: FC<IDialog> = ({ id = uuidv4(), open = true }) => {
  const { loadSample, setResource } = useActions().storage;
  const { closeDialog } = useActions().ui;

  const navigate = useNavigate();
  const { t } = useTranslation('commons');

  const [selected, setSelected] = useState<ISample>();

  const handleClose = (_event: MouseEvent, reason: string) => closeDialog(id);
  const handleCancel = () => closeDialog(id);
  const handleSelect = (value: ISample) => setSelected(value);

  const handleCreate = async () => {
    if (!selected) return;
    closeDialog(id);
    load();
  };

  const load = async () => {
    if (!selected) return;
    const content = await loadSample(selected.url);
    setResource({ content, filename: `${selected.title}.xml` });
    navigate(`/edit?template=${selected.title}`, { replace: true });
  };

  return (
    <Dialog fullWidth id={id} maxWidth="sm" onClose={handleClose} open={open}>
      <DialogTitle sx={{ ':first-letter': { textTransform: 'uppercase' } }}>
        {t('templates:choose_a_template')}
      </DialogTitle>
      <DialogContent>
        <TemplatesView onSelect={handleSelect} selected={selected} type="doubleClick" />
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button onClick={handleCancel}>{t('cancel')}</Button>
        <Button onClick={handleCreate} variant="outlined">
          {t('create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
