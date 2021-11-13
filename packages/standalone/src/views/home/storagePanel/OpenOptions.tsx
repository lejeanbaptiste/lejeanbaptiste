import CloudIcon from '@mui/icons-material/Cloud';
import { Button, Stack, TextField, Typography } from '@mui/material';
import { useActions } from '@src/overmind';
import React, { ChangeEvent, FC } from 'react';
import { useTranslation } from 'react-i18next';

const OpenOptions: FC = () => {
  const { openStorageDialog } = useActions();
  const { t } = useTranslation();

  const onCloudClick = () => openStorageDialog({ source: 'cloud', type: 'load' });
  const onLocalClick = () => openStorageDialog({ source: 'local', type: 'load' });

  const onChageTextfield = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const pastedText = event.target.value;
    event.target.value = '';
    openStorageDialog({ resource: pastedText, source: 'paste', type: 'load' });
  };

  const onSaveCloud = () => openStorageDialog({ source: 'cloud', type: 'save' });

  return (
    <Stack spacing={2} sx={{ maxWidth: 250 }}>
      <Typography
        align="center"
        component="h5"
        mb={2}
        sx={{ fontWeight: 700, textTransform: 'uppercase' }}
        variant="h6"
      >
        {t('home:open')}
      </Typography>
      <Button disableElevation onClick={onCloudClick} startIcon={<CloudIcon />} variant="contained">
        {t('home:from_cloud')}
      </Button>
      <Button onClick={onLocalClick} variant="outlined">
        {t('home:from_Your_computer')}
      </Button>
      <TextField
        placeholder={t('home:or_paste_your_XML_here')}
        size="small"
        onChange={onChageTextfield}
      />
      <Button color="secondary" onClick={onSaveCloud} startIcon={<CloudIcon />} variant="contained">
        Save
      </Button>
    </Stack>
  );
};

export default OpenOptions;
