import { Button, Dialog, DialogActions, DialogTitle } from '@mui/material';
import { TemplatesView, TopBar, type DisplayLayout } from '@src/components';
import { useActions } from '@src/overmind';
import type { Resource } from '@src/types';
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

  const [displayLayout, setDisplayLayout] = useState<DisplayLayout>('list');
  const [selected, setSelected] = useState<Resource>();

  const changeDisplayLayout = (value: DisplayLayout) => setDisplayLayout(value);

  const handleClose = (_event: MouseEvent, reason: string) => closeDialog(id);
  const handleCancel = () => closeDialog(id);
  const handleSelect = (value: Resource) => setSelected(value);

  const handleCreate = async () => {
    if (!selected) return;
    closeDialog(id);
    load();
  };

  const load = async () => {
    if (!selected || !selected.url) return;
    const content = await loadSample(selected.url);
    setResource({ content, filename: `${selected.title}.xml` });
    navigate(`/edit?template=${selected.title}`, { replace: true });
  };

  return (
    <Dialog fullWidth id={id} maxWidth="sm" onClose={handleClose} open={open}>
      <DialogTitle>
        <TopBar
          displayLayout={displayLayout}
          onChangeDisplayLayout={changeDisplayLayout}
          title={t('templates:choose_a_template')}
        />
      </DialogTitle>
      <TemplatesView
        displayLayout={displayLayout}
        onSelect={handleSelect}
        selected={selected}
        type="doubleClick"
        width={600}
      />
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button onClick={handleCancel}>{t('cancel')}</Button>
        <Button onClick={handleCreate} variant="outlined">
          {t('create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
