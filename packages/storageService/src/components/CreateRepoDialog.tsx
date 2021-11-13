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
import { useActions } from '../overmind';
import React, { ChangeEvent, FC, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface CreateRepoDialogProps {
  onCancel: () => void;
  onCreate: () => void;
  open: boolean;
}

const CreateRepoDialog: FC<CreateRepoDialogProps> = ({ onCancel, onCreate, open }) => {
  const { t } = useTranslation();
  const { showMessageDialog } = useActions().common;
  const { createRepo } = useActions().cloud;

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
      showMessageDialog({
        title: t('error:title:error'),
        message: t('error:message:repo_creation_error'),
        onClose: async () => setIsLoading(false),
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
      fullWidth
      maxWidth="sm"
      open={open}
    >
      <DialogTitle id="create-repository-title">{t('cloud:createRepo:create_repository')}</DialogTitle>
      <DialogContent>
        <Stack spacing={4}>
          <TextField
            autoComplete="off"
            autoFocus
            fullWidth
            id="name"
            label={t('commons:name')}
            onChange={handleNameChange}
            placeholder={t('cloud:createRepo:repository_name')}
            required
            value={name}
            variant="standard"
          />
          <TextField
            autoComplete="off"
            fullWidth
            helperText={t('cloud:createRepo:description_help')}
            id="description"
            label={t('cloud:createRepo:description')}
            onChange={handleDescriptionChange}
            value={description}
            variant="outlined"
          />
          <FormControlLabel
            control={
              <Switch checked={privateRepo} onChange={handleChangePrivateRepo} size="small" />
            }
            // label={t('commons:private')}
            label={'Private'}
          />
        </Stack>
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

export default CreateRepoDialog;
