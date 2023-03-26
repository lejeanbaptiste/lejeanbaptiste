import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Formik } from 'formik';
import { useModal } from 'mui-modal-provider';
import React, { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import * as yup from 'yup';
import { TextEmphasis } from '../components';
import { useActions, useAppState } from '../overmind';
import type { Schema, SchemaMappingType } from '../types';
import { type EditSchemaDialogProps } from './type';

interface SchemaForm {
  name: string;
  mapping: SchemaMappingType;
  rng: string;
  css: string;
}

const defaultValue: SchemaForm = { name: '', mapping: 'tei', rng: '', css: '' };

const regexHttps = /^(https)\:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,6}(\/\S*)?$/;

export const EditSchemaDialog = ({
  actionType = 'add',
  docSchema,
  id = uuidv4(),
  mappingIds = [],
  maxWidth = 'md',
  onAcceptChanges,
  onClose,
  onDelete,
  open = false,
  schemaId,
}: EditSchemaDialogProps) => {
  const { schemaId: documentSchemaId } = useAppState().document;
  const { schemas } = useAppState().editor;

  const { addSchema, deleteSchema, updateSchema } = useActions().editor;
  const { closeDialog, openDialog } = useActions().ui;

  const { destroyModal } = useModal();

  const { t } = useTranslation('leafwriter');

  const [initialValues, setInitialValues] = useState<SchemaForm>(defaultValue);

  const preventEscape = actionType === 'add';

  const httpsUrl = yup
    .string()
    .url(t('Must be a valid URL').toString())
    .matches(regexHttps, t('Must be a valid HTTP URL').toString());

  const formValidation = yup.object().shape({
    name: yup
      .string()
      .required(t('Every schema needs a name').toString())
      .min(3, t('Must be at least characters', { min: 3 }).toString())
      .max(20, t('Cannot have more than characters', { max: 20 }).toString()),
    mapping: yup.string().required(),
    rng: httpsUrl.required(t('Schema URL is required').toString()),
    css: httpsUrl,
  });

  useEffect(() => {
    if (schemaId) {
      const schema = schemas[schemaId];
      if (!schema) return;

      const { name, mapping, rng, css } = schema;
      if (!rng[0] || !css[0]) return;

      setInitialValues({ name, mapping, rng: rng[0], css: css[0] });
      return;
    }
    if (docSchema) {
      setInitialValues({ ...initialValues, rng: docSchema.rng ?? '', css: docSchema.css ?? '' });
    }
  }, [schemaId]);

  const handleBeforeClose = () => {
    setInitialValues(defaultValue);
  };

  const handleClose = async (_event: MouseEvent, reason: string) => {
    if (preventEscape && (reason === 'backdropClick' || reason === 'escapeKeyDown')) {
      return;
    }

    handleBeforeClose();
    closeDialog(id);
    onClose && onClose(reason);
  };

  const handleCancel = () => {
    handleBeforeClose();
    closeDialog(id);
    onClose && onClose('cancel');
  };

  const handleDelete = async () => {
    if (!schemaId) return;
    const name = schemas[schemaId]?.name;
    if (!name) return;
    openDialog({
      type: 'simple',
      props: {
        maxWidth: 'xs',
        title: t('deleteSchema').toString(),
        preventEscape: true,
        Message: () => (
          <Trans i18nKey="messages.deleteConfirmationMessage" values={{ name }}>
            <Typography component="span">Are you sure you want to delete{` `}</Typography>
            <TextEmphasis color="info">{name}</TextEmphasis>
            <Typography component="span"> schema?</Typography>
          </Trans>
        ),
        actions: [
          { action: 'cancel', label: t('commons:cancel').toString() },
          { action: 'delete', label: t('commons:delete').toString(), variant: 'outlined' },
        ],
        onClose: async (action) => {
          if (action !== 'delete') return;

          destroyModal(id);
          handleCancel();

          deleteSchema(schemaId);

          handleBeforeClose();
          onDelete && (await onDelete(schemaId));
          closeDialog(id);
          onClose && onClose('delete', schemaId);
        },
      },
    });
  };

  const submit = async ({ name, mapping, rng, css }: SchemaForm) => {
    const schemaToSubmit: Schema | Omit<Schema, 'id'> = {
      id: schemaId ?? undefined,
      name,
      mapping,
      rng: [rng],
      css: [css],
      editable: true,
    };

    if (!schemaToSubmit) return;

    const schema = schemaId ? updateSchema(schemaToSubmit as Schema) : addSchema(schemaToSubmit);
    if (!schema) return;

    if (schemaId) schema.id = schemaId;

    handleBeforeClose();
    onAcceptChanges && (await onAcceptChanges(schema));
    closeDialog(id);
    onClose && onClose(actionType, schema);
  };

  return (
    <Dialog
      aria-labelledby="alert-dialog-title"
      disableAutoFocus
      disableEscapeKeyDown={preventEscape}
      fullWidth
      id={id}
      maxWidth={maxWidth}
      onClose={handleClose}
      open={open}
    >
      <DialogTitle id="form-dialog-title" sx={{ textTransform: 'capitalize' }} variant="h5">
        {actionType === 'add' ? t('add schema') : t('Change Schema')}
      </DialogTitle>
      <Formik
        enableReinitialize={true}
        initialValues={initialValues}
        onSubmit={submit}
        validationSchema={formValidation}
      >
        {({ dirty, errors, handleBlur, handleChange, handleSubmit, touched, values }) => (
          <form onSubmit={handleSubmit}>
            <DialogContent>
              <Stack
                direction="row"
                alignItems="center"
                gap={2}
                justifyContent="space-between"
                mb={2}
              >
                <TextField
                  autoFocus
                  autoComplete="off"
                  error={Boolean(touched.name && errors.name)}
                  fullWidth
                  helperText={touched.name && errors.name ? errors.name : ' '}
                  label={t('commons:Name')}
                  margin="dense"
                  name="name"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  size="small"
                  sx={{ ':first-letter': { textTransform: 'uppercase' } }}
                  value={values.name}
                />
                {mappingIds.length > 1 && (
                  <Box width={250} mb={3}>
                    <TextField
                      fullWidth
                      label="Mapping"
                      inputProps={{ sx: { textTransform: 'uppercase' } }}
                      margin="dense"
                      name="mapping"
                      onBlur={handleBlur}
                      onChange={handleChange}
                      size="small"
                      select
                      sx={{ ':first-letter': { textTransform: 'uppercase' } }}
                      value={values.mapping}
                    >
                      {mappingIds.map((id) => (
                        <MenuItem key={id} sx={{ textTransform: 'uppercase' }} value={id}>
                          {id}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                )}
              </Stack>
              <TextField
                autoComplete="off"
                error={Boolean(touched.rng && errors.rng)}
                fullWidth
                helperText={touched.rng && errors.rng ? errors.rng : ' '}
                label="Schema URL"
                margin="dense"
                name="rng"
                onBlur={handleBlur}
                onChange={handleChange}
                placeholder="https://"
                size="small"
                sx={{ ':first-letter': { textTransform: 'uppercase' } }}
                value={values.rng}
              />
              <TextField
                autoComplete="off"
                error={Boolean(touched.css && errors.css)}
                fullWidth
                helperText={touched.css && errors.css ? errors.css : ' '}
                label="CSS URL"
                margin="dense"
                name="css"
                onBlur={handleBlur}
                onChange={handleChange}
                placeholder="https://"
                size="small"
                sx={{ ':first-letter': { textTransform: 'uppercase' } }}
                value={values.css}
              />
              {actionType === 'add' && (
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
              )}
            </DialogContent>

            <DialogActions sx={{ justifyContent: 'space-between' }}>
              <Button onClick={handleCancel}>{t('commons:cancel')}</Button>

              {schemaId && (
                <Tooltip
                  placement="top"
                  title={
                    schemaId === documentSchemaId
                      ? t('The current document is using this schema')
                      : ''
                  }
                >
                  <span>
                    <Button
                      color="error"
                      disabled={schemaId === documentSchemaId}
                      onClick={handleDelete}
                    >
                      {t('commons:delete')}
                    </Button>
                  </span>
                </Tooltip>
              )}

              <Button color="primary" disabled={!dirty} type="submit" variant="outlined">
                {schemaId ? t('commons:update') : t('commons:add')}
              </Button>
            </DialogActions>
          </form>
        )}
      </Formik>
    </Dialog>
  );
};
