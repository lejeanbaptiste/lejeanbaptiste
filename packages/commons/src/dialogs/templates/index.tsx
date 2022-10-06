import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from '@mui/material';
import { useAppState } from '@src/overmind';
import { type IDocTemplate } from '@src/types';
import React, { useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { v4 as uuidv4 } from 'uuid';
import { useActions } from '../../overmind';
import { type IDialog } from '../type';
import { TemplateCategory } from './TemplateCategory';

export const TemplateDialog: FC<IDialog> = ({ id = uuidv4(), open = true }) => {
  const { templates } = useAppState().storage;
  const { loadTemplate, setResource } = useActions().storage;
  const { closeDialog } = useActions().ui;

  const navigate = useNavigate();
  const { t } = useTranslation('commons');

  const [selected, setSelected] = useState<IDocTemplate | null>(null);

  const categories = new Set([...templates.map((template) => template.category)]);

  const handleClose = (_event: MouseEvent, reason: string) => closeDialog(id);
  const handleCancel = () => closeDialog(id);
  const handleSelect = (value: IDocTemplate) => setSelected(value);

  const handledSelectCreate = (value: IDocTemplate) => {
    setSelected(value);
    if (!selected) return;
    closeDialog(id);
    load();
  };

  const handleCreate = async () => {
    if (!selected) return;
    closeDialog(id);
    load();
  };

  const load = async () => {
    if (!selected) return;
    const documentString = await loadTemplate(selected.url);
    setResource({ content: documentString });
    navigate(`/edit?template=${selected.title}`, { replace: true });
  };

  return (
    <Dialog fullWidth id={id} maxWidth="sm" onClose={handleClose} open={open}>
      <DialogTitle sx={{ ':first-letter': { textTransform: 'uppercase' } }}>
        {t('templates:choose_a_template')}
      </DialogTitle>
      <DialogContent>
        <Stack my={2} spacing={3}>
          {[...categories.values()].map((category) => (
            <TemplateCategory
              key={category}
              category={category}
              onSelect={handleSelect}
              onDoubleClick={handledSelectCreate}
              selected={selected}
              templates={templates.filter((template) => template.category === category)}
            />
          ))}
        </Stack>
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
