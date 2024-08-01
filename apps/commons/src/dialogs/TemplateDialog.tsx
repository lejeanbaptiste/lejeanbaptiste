import { Button, Dialog, DialogActions, DialogTitle } from '@mui/material';
import { TemplatesView, TopBar, type Layout } from '@src/views/storage/documents';
import { useOpenResource } from '@src/hooks';
import { useActions } from '@src/overmind';
import type { Resource } from '@src/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import type { IDialog } from './type';

export const TemplateDialog = ({ id = uuidv4(), open = true }: IDialog) => {
  const { closeDialog } = useActions().ui;

  const { t } = useTranslation();
  const { openFromLibrary } = useOpenResource();

  const [layout, setLayout] = useState<Layout>('list');
  const [selected, setSelected] = useState<Resource>();

  const changeLayout = (value: Layout) => setLayout(value);

  const handleClose = (_event: MouseEvent, reason: string) => closeDialog(id);
  const handleCancel = () => closeDialog(id);
  const handleSelect = (value: Resource) => setSelected(value);

  const handleCreate = async () => {
    if (!selected) return;
    closeDialog(id);
    load();
  };

  const load = async () => {
    if (!selected?.title) return;
    openFromLibrary({ category: 'template', title: selected.title });
  };

  const handleOnLoad = () => closeDialog(id);

  return (
    <Dialog fullWidth id={id} maxWidth="sm" onClose={handleClose} open={open}>
      <DialogTitle>
        <TopBar
          layout={layout}
          onLayoutChange={changeLayout}
          title={`${t('LWC.templates.choose_a_template')}`}
        />
      </DialogTitle>
      <TemplatesView
        layout={layout}
        onLoad={handleOnLoad}
        onSelect={handleSelect}
        selected={selected}
        width={600}
      />
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button onPointerDown={handleCancel}>{t('LWC.commons.cancel')}</Button>
        <Button onPointerDown={handleCreate} variant="outlined">
          {t('LWC.commons.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
