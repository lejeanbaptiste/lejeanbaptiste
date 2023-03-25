import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../overmind';
import type { Schema, SchemaMappingType } from '../types';
import { type IDialog } from './type';

export interface SelectSchemaDialogProps extends IDialog {
  mappingIds?: SchemaMappingType[];
  onSchemaSelect?: (schema: Schema) => void;
}

export const SelectSchemaDialog = ({
  id,
  maxWidth = 'xs',
  mappingIds = [],
  onClose,
  onSchemaSelect,
  open,
  preventEscape = true,
}: SelectSchemaDialogProps) => {
  const { closeDialog } = useActions().ui;
  const { t } = useTranslation(['leafwriter']);

  const { schemasList } = useAppState().editor;

  const possibleSchemas = schemasList.filter((schema) => mappingIds.includes(schema.mapping));

  const defaultSchema = mappingIds.includes('tei')
    ? possibleSchemas.find((schema) => schema.id === 'teiAll')
    : possibleSchemas[0];

  const [schema, setSchema] = useState<Schema>(defaultSchema);

  const handleSchemaSelect = (event: SelectChangeEvent) => {
    const schemaId = event.target.value;
    const selectedChema = possibleSchemas.find(({ id }) => id === schemaId);

    setSchema(selectedChema);
  };

  const handleClose = async (_event: MouseEvent, reason: string) => {
    if (preventEscape && (reason === 'backdropClick' || reason === 'escapeKeyDown')) {
      return;
    }

    closeDialog(id);
    onClose && onClose<Schema>(reason, schema);
  };

  const handleCancel = () => {
    closeDialog(id);
    onClose && onClose('cancel');
  };

  const handleSelect = () => {
    closeDialog(id);
    onSchemaSelect && onSchemaSelect(schema);
    onClose && onClose<Schema>('select', schema);
  };

  return (
    <Dialog
      aria-labelledby="alert-dialog-title"
      disableAutoFocus
      fullWidth
      id={id}
      maxWidth={maxWidth}
      onClose={handleClose}
      open={open}
    >
      <DialogTitle id="alert-dialog-title" sx={{ textTransform: 'capitalize' }} variant="h5">
        {t('Select schema')},
      </DialogTitle>

      <DialogContent>
        <Stack mt={2}>
          <FormControl fullWidth>
            <InputLabel id="select-schema-label" sx={{ textTransform: 'capitalize' }}>
              {t('commons:schema')}
            </InputLabel>
            <Select
              fullWidth
              label="schema"
              labelId="select-schema-label"
              onChange={handleSchemaSelect}
              size="small"
              value={schema?.id}
            >
              {schemasList
                .filter((schema) => mappingIds.includes(schema.mapping))
                .map(({ id, name }) => (
                  <MenuItem key={id} sx={{ textTransform: 'uppercase' }} value={id}>
                    {name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <Stack mt={2}>
            <Typography variant="caption">
              <span style={{ textTransform: 'uppercase', textDecoration: 'underline' }}>
                {t('note')}:
              </span>
              {` ${t(
                'LEAF-Writer cannot guarantee that the document will work correctly with the selected schema'
              )}.
          ${t('Tagging might not work as expected')}.`}
            </Typography>
          </Stack>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button onClick={handleCancel}>{t('commons:cancel')}</Button>
        <Button color="primary" onClick={handleSelect} variant="outlined">
          {t('commons:select')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
