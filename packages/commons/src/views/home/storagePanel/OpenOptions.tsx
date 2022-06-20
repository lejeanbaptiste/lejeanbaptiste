import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import ComputerIcon from '@mui/icons-material/Computer';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import { Button, Divider, Stack, TextField, Typography, useTheme } from '@mui/material';
import { useActions } from '@src/overmind';
import React, { useState, type ChangeEvent, type FC } from 'react';
import { useTranslation } from 'react-i18next';

const OpenOptions: FC = () => {
  const { openStorageDialog } = useActions().storage;
  const { t } = useTranslation();
  const { palette } = useTheme();
  const [pasteHover, setPasteHover] = useState(false);

  const onCloudClick = () => openStorageDialog({ source: 'cloud', type: 'load' });
  const onLocalClick = () => openStorageDialog({ source: 'local', type: 'load' });

  const onChageTextfield = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const pastedText = event.target.value;
    event.target.value = '';
    openStorageDialog({ resource: pastedText, source: 'paste', type: 'load' });
  };

  return (
    <Stack spacing={1} alignItems="flex-start" sx={{ width: 240 }}>
      <Typography sx={{ fontWeight: 700, letterSpacing: '.15rem', textTransform: 'uppercase' }}>
        {t('home:open')}
      </Typography>
      <Stack direction="row" spacing={1}>
        <Divider
          flexItem
          orientation="vertical"
          sx={{ borderColor: '#999', ml: 0.5, boxShadow: '2px 0px 2px 0px rgb(0 0 0 / 15%)' }}
        />
        <Stack spacing={2} alignItems="flex-start">
          <Button
            color="primary"
            onClick={onCloudClick}
            startIcon={<CloudOutlinedIcon />}
            sx={{
              color: 'inherit',
              px: 1,
              '&:hover': {
                color: palette.primary.main,
                backgroundColor: 'transparent',
              },
            }}
          >
            {t('home:from_cloud')}
          </Button>
          <Button
            color="primary"
            onClick={onLocalClick}
            startIcon={<ComputerIcon />}
            sx={{
              color: 'inherit',
              px: 1,
              '&:hover': {
                color: palette.primary.main,
                backgroundColor: 'transparent',
              },
            }}
          >
            {t('home:from_Your_computer')}
          </Button>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            pl={0.25}
            onMouseOver={() => setPasteHover(true)}
            onMouseOut={() => setPasteHover(false)}
          >
            <ContentPasteIcon color={pasteHover ? 'primary' : 'inherit'} />
            <TextField
              color="primary"
              InputProps={{ sx: { fontSize: '0.9rem' } }}
              onChange={onChageTextfield}
              placeholder={t('home:or_paste_your_XML_here')}
              size="small"
              sx={{
                '& fieldset': {
                  borderColor: pasteHover ? palette.primary.main : 'inherit',
                },
              }}
            />
          </Stack>
        </Stack>
      </Stack>
    </Stack>
  );
};

export default OpenOptions;
