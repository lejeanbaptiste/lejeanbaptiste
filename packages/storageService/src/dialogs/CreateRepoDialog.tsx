import { LoadingButton } from '@mui/lab';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import React, { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions } from '../overmind';

interface CreateRepoDialogProps {
  onCancel: () => void;
  onCreate: () => void;
  open: boolean;
}

export const CreateRepoDialog = ({ onCancel, onCreate, open }: CreateRepoDialogProps) => {
  const { createRepo } = useActions().cloud;
  const { openDialog } = useActions().ui;

  const { t } = useTranslation('LWStorageService');

  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [privateRepo, setPrivateRepo] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    setName(inputValue);
  };

  const handleDescriptionChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    setDescription(inputValue);
  };

  const handleChangePrivateRepo = (event: ChangeEvent<HTMLInputElement>) => {
    setPrivateRepo(event.target.checked);
  };

  const handleCancel = () => onCancel();

  const handleCreate = async () => {
    if (name === '') return;
    setIsLoading(true);
    const repo = await createRepo({ name, description, isPrivate: privateRepo });

    if (!repo) {
      openDialog({
        props: {
          maxWidth: 'xs',
          preventEscape: true,
          severity: 'error',
          title: `${t('cloud.message.repo_creation_error')}`,
          onClose: () => setIsLoading(false),
        },
      });

      return;
    }

    setIsLoading(false);
    onCreate();
  };

  return (
    <Dialog
      aria-describedby="create-repository"
      aria-labelledby="create-repository-title"
      data-testid="save:create-repo-dialog"
      fullWidth
      maxWidth="sm"
      open={open}
    >
      <DialogTitle id="create-repository-title">
        {t('cloud.createRepo.create_repository')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={4}>
          <TextField
            autoComplete="off"
            autoFocus
            fullWidth
            id="name"
            inputProps={{ 'data-testid': 'save:create-repo:name-input' }}
            label={t('commons.name')}
            onChange={handleNameChange}
            placeholder={`${t('cloud.createRepo.repository_name')}`}
            required
            value={name}
            variant="standard"
          />
          <TextField
            autoComplete="off"
            fullWidth
            helperText={t('cloud.createRepo.description_help')}
            id="description"
            inputProps={{ 'data-testid': 'save:create-repo:description-input' }}
            label={t('cloud.createRepo.description')}
            onChange={handleDescriptionChange}
            value={description}
            variant="outlined"
          />
          <FormControlLabel
            control={
              <Switch checked={privateRepo} onChange={handleChangePrivateRepo} size="small" />
            }
            label={t('commons.private')}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>{t('commons.cancel')}</Button>
        <LoadingButton
          data-testid="save:create-repo:create-button"
          disabled={name === ''}
          loading={isLoading}
          onClick={handleCreate}
          variant="contained"
        >
          {t('commons.create')}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};
