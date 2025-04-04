import { Button, Dialog, DialogActions, DialogContent, Stack, Typography } from '@mui/material';
import { TextEmphasis } from '@src/components';
import { Form, Formik } from 'formik';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toFormikValidationSchema } from 'zod-formik-adapter';
import { localAuthorityServiceConfigSchema } from '../../types';
import SimpleDialog from '../SimpleDialog';
import { AdvancedOptions, BasicInformation, EntityTypes, Header, Instructions } from './components';
import { useCustomAuthorityDialog } from './useCustomAuthorityDialog';

export type CustomAuthorityDialogProps = {
  authorityId?: string;
  open: boolean;
  onClose: () => void;
};

//TODO - Guidance... add to the UI
// https://docs.google.com/document/d/1R5NvSXMZZDMcvNg85fBTCZlAyLUlG7Q_-2KLVqDvpxU/edit?tab=t.0

export const CustomAuthorityDialog = ({
  authorityId,
  open,
  onClose,
}: CustomAuthorityDialogProps) => {
  const { t } = useTranslation();
  const { deleteAuthority, initialValue, addAuthority, updateAuthority } =
    useCustomAuthorityDialog(authorityId);

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  const handleDelete = async () => {
    await deleteAuthority();
    onClose();
  };

  return (
    <Dialog
      disableEscapeKeyDown
      onClose={(_event, reason) => reason !== 'backdropClick' && onClose()}
      open={open}
    >
      <Formik
        enableReinitialize={true}
        initialValues={initialValue}
        onSubmit={async (values) => {
          authorityId ? await updateAuthority(values) : await addAuthority(values);
          onClose();
        }}
        validationSchema={toFormikValidationSchema(localAuthorityServiceConfigSchema)}
      >
        {({ dirty, isSubmitting, handleSubmit }) => (
          <Form onSubmit={handleSubmit}>
            <Header onClose={onClose} type={!!authorityId ? 'edit' : 'add'} />
            <DialogContent
              dividers
              sx={{ display: 'flex', flexDirection: 'column', height: 700, gap: 2 }}
            >
              <Instructions />
              <BasicInformation editing={!!authorityId} />
              <EntityTypes />
              <AdvancedOptions />
            </DialogContent>
            <DialogActions sx={{ justifyContent: !!authorityId ? 'space-between' : 'flex-end' }}>
              {!!authorityId && (
                <Button color="error" onClick={() => setOpenDeleteDialog(true)} variant="outlined">
                  Delete
                </Button>
              )}
              <Stack direction="row" spacing={2}>
                <Button onClick={onClose}>Cancel</Button>
                <Button disabled={!dirty} loading={isSubmitting} type="submit" variant="contained">
                  {!!authorityId ? 'save' : 'add'}
                </Button>
              </Stack>
            </DialogActions>
          </Form>
        )}
      </Formik>
      {openDeleteDialog && (
        <SimpleDialog
          maxWidth="xs"
          open={open}
          title="Delete Authority"
          actions={[
            { action: 'cancel', label: t('LW.commons.cancel') },
            { action: 'delete', label: t('LW.commons.delete'), variant: 'outlined' },
          ]}
          onClose={async (action) => {
            setOpenDeleteDialog(false);
            if (action === 'delete') handleDelete();
          }}
        >
          {/* <Trans i18nKey="LW.messages.delete confirmation message" values={{ name }}> */}
          <Typography component="span">
            Are you sure you want to delete the authority{` `}
          </Typography>
          <TextEmphasis color="info">{initialValue.name}</TextEmphasis>
          <Typography component="span">?</Typography>
          {/* </Trans> */}
        </SimpleDialog>
      )}
    </Dialog>
  );
};
