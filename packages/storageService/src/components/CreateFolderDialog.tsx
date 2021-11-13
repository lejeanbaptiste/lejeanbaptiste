import { LoadingButton } from '@mui/lab';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useActions } from '../overmind';
import React, { ChangeEvent, FC, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface CreateRepoDialogProps {
  onCancel: () => void;
  onCreate: () => void;
  open: boolean;
}

const CreateFolderDialog: FC<CreateRepoDialogProps> = ({ onCancel, onCreate, open }) => {
  const { t } = useTranslation();
  const { showMessageDialog } = useActions().common;
  const { createFolder } = useActions().cloud;

  const [name, setName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    setName(inputValue);
  };

  const handleCancel = () => onCancel();

  const handleCreate = async () => {
    if (name === '') return;
    setIsLoading(true);
    const folder = await createFolder(name);

    if (!folder) {
      showMessageDialog({
        title: t('error:title:error'),
        message: t('error:message:folder_creation_error'),
        onClose: async () => setIsLoading(false),
      });
      return;
    }

    setIsLoading(false);
    onCreate();
  };

  return (
    <Dialog
      aria-describedby="create-folder"
      aria-labelledby="create-folder-title"
      fullWidth
      maxWidth="sm"
      open={open}
    >
      <DialogTitle id="create-folder-title">{t('cloud:create_folder')}</DialogTitle>
      <DialogContent>
        <TextField
          autoComplete="off"
          autoFocus
          fullWidth
          id="name"
          label={t('commons:name')}
          onChange={handleNameChange}
          placeholder={t('cloud:folder_name')}
          required
          value={name}
          variant="standard"
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel}>{t('commons:cancel')}</Button>
        <LoadingButton
          disabled={name === ''}
          loading={isLoading}
          onClick={handleCreate}
          variant="contained"
        >
          {t('commons:create')}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};

export default CreateFolderDialog;
